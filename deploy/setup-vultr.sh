#!/usr/bin/env bash
# Prepare an Ubuntu Vultr VM for QuoteCage. Run from the repository root:
#   sudo bash deploy/setup-vultr.sh
# Optional: INSTALL_GVISOR=1 sudo bash deploy/setup-vultr.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root on the Ubuntu VM." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if [ "${INSTALL_GVISOR:-0}" = "1" ]; then
  apt-get install -y python3
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
    > /etc/apt/sources.list.d/gvisor.list
  apt-get update
  if apt-get install -y runsc; then
    # Registers the runtime. QuoteCage then pins --network=host, which is gVisor's
    # name for "use the kernel stack inside the network namespace Docker already
    # created." It does not put the sandbox on the host network.
    runsc install || echo "runsc install did not complete. The daemon.json patch below still registers it when the binary exists."
    python3 - <<'PY'
import json
from pathlib import Path
path = Path("/etc/docker/daemon.json")
cfg = {}
if path.exists() and path.read_text().strip():
    cfg = json.loads(path.read_text())
runtimes = cfg.setdefault("runtimes", {})
runsc = runtimes.setdefault("runsc", {})
runsc["path"] = runsc.get("path") or "/usr/bin/runsc"
kept = []
skip = False
for arg in runsc.get("runtimeArgs") or []:
    if skip:
        skip = False
        continue
    if arg == "--network" or str(arg).startswith("--network="):
        if arg == "--network":
            skip = True
        continue
    kept.append(arg)
kept.append("--network=host")
runsc["runtimeArgs"] = kept
path.write_text(json.dumps(cfg, indent=2) + "\n")
print("runsc runtimeArgs:", " ".join(kept))
PY
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet docker; then
      systemctl restart docker || echo "Could not restart Docker. Restart it manually so runsc --network=host is loaded."
      echo "Restarted Docker so runsc --network=host is loaded. Start the stack again with: docker compose up -d"
    else
      echo "Docker is not running under systemd. Restart dockerd so it reloads /etc/docker/daemon.json."
    fi
  else
    echo "gVisor packages were not installed. QuoteCage will keep using runc."
  fi
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p /var/quotecage/work /var/quotecage/allow /etc/sysctl.d
chmod 755 /var/quotecage /var/quotecage/work /var/quotecage/allow

# On some kernels Docker's bridge iptables drop same-bridge container traffic.
# Routed packets, including the internal sandbox network's egress filter, still
# pass through iptables. Load the module first so the sysctl exists.
modprobe br_netfilter 2>/dev/null || true
cat > /etc/sysctl.d/99-quotecage.conf <<'EOF'
net.bridge.bridge-nf-call-iptables=0
net.bridge.bridge-nf-call-ip6tables=0
EOF
sysctl --system >/dev/null 2>&1 || true

# Docker 29 writes its filter rules with iptables-nft. A leftover
# iptables-legacy FORWARD policy of DROP, from an older Docker on the same
# host, still runs and drops the packet after nft accepts it. Container
# traffic to the public internet then hangs (the egress CONNECT never
# returns) even though fixture hosts on the sandbox bridge still work.
if command -v iptables-legacy >/dev/null 2>&1; then
  legacy_policy=$(iptables-legacy -S FORWARD 2>/dev/null | awk 'NR==1 { print $3 }')
  if [ "$legacy_policy" = "DROP" ]; then
    echo "Clearing a stale iptables-legacy FORWARD DROP so sandboxes can reach allowlisted sites."
    iptables-legacy -P FORWARD ACCEPT || true
  fi
fi

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's/^HTTP_PORT=.*/HTTP_PORT=80/' .env
  sed -i 's/^HTTPS_PORT=.*/HTTPS_PORT=443/' .env
  echo "Wrote .env with HTTP on port 80. Put the inference key in VULTR_INFERENCE_API_KEY if you want live models."
fi

echo "Next: edit .env, then run: docker compose up -d --build"
