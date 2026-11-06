import http from "node:http";
import net from "node:net";
import { readFileSync } from "node:fs";
import { decideEgress } from "./policy.mjs";

const port = Number(process.env.PORT || 3128);
const allowFile = process.env.ALLOW_FILE || "";

function allowHosts() {
  if (allowFile) {
    try {
      const parsed = JSON.parse(readFileSync(allowFile, "utf8"));
      if (Array.isArray(parsed.hosts) && parsed.hosts.length > 0) return parsed.hosts;
    } catch {
      // Fall through to the static list if the control plane has not written one yet.
    }
  }
  return (process.env.EGRESS_ALLOW_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function deny(res, host) {
  console.log(`egress deny host=${host}`);
  res.writeHead(403, { "content-type": "text/plain", "x-quotecage-egress": "deny" });
  res.end(`egress denied: ${host}`);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  let target;
  try {
    target = new URL(req.url || "");
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("bad url");
    return;
  }
  const decision = decideEgress(target.href, allowHosts());
  if (!decision.allow) {
    deny(res, decision.host || target.hostname);
    return;
  }
  const headers = { ...req.headers, host: target.host };
  delete headers["proxy-connection"];
  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("bad gateway");
  });
  req.pipe(upstream);
});

server.on("connect", (req, clientSocket, head) => {
  const [host, portRaw] = String(req.url || "").split(":");
  const decision = decideEgress(`https://${host}/`, allowHosts());
  if (!decision.allow) {
    console.log(`egress deny host=${host}`);
    clientSocket.write("HTTP/1.1 403 Forbidden\r\nX-QuoteCage-Egress: deny\r\nContent-Length: 0\r\n\r\n");
    clientSocket.end();
    return;
  }
  const upstream = net.connect(Number(portRaw) || 443, host, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head?.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  const fail = () => {
    clientSocket.end();
    upstream.destroy();
  };
  upstream.on("error", fail);
  clientSocket.on("error", () => upstream.destroy());
});

server.listen(port, "0.0.0.0", () => {
  console.log(`egress proxy listening on ${port}`);
});
