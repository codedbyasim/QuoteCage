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
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
    > /etc/apt/sources.list.d/gvisor.list
  apt-get update
  if apt-get install -y runsc; then
    runsc install || echo "runsc install did not complete. QuoteCage will keep using runc."
    systemctl reload docker || true
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

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's/^HTTP_PORT=.*/HTTP_PORT=80/' .env
  sed -i 's/^HTTPS_PORT=.*/HTTPS_PORT=443/' .env
  echo "Wrote .env with HTTP on port 80. Put the inference key in VULTR_INFERENCE_API_KEY if you want live models."
fi

echo "Next: edit .env, then run: docker compose up -d --build"
