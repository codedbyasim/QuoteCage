import http from "node:http";
import { readFileSync } from "node:fs";
import { renderPage } from "./render.mjs";

const catalog = JSON.parse(readFileSync(new URL("../shared/catalog.json", import.meta.url), "utf8"));
const port = Number(process.env.PORT || 80);

const hostToVendor = new Map(catalog.vendors.map((vendor) => [vendor.host, vendor.id]));
hostToVendor.set("localhost", "reedmill");
hostToVendor.set("fixtures", "reedmill");
hostToVendor.set("127.0.0.1", "reedmill");

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://fixtures");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  const vendorId = hostToVendor.get(host);
  if (!vendorId) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("unknown fixture host");
    return;
  }
  const page = renderPage({ catalog, vendorId, pathname: url.pathname, searchParams: url.searchParams });
  res.writeHead(page.status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-quotecage-fixture": vendorId,
  });
  res.end(page.html);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`fixtures listening on ${port}`);
});
