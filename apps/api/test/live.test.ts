import assert from "node:assert/strict";
import test from "node:test";
import { allowRulesForHosts, chooseVisiblePrice, detectBlock, recommendLive } from "../../../shared/live-extract.mjs";
import { loadRealVendors, resolveLiveTargets } from "../src/live.ts";

test("a price is taken only from text that is actually on the page", () => {
  const text = "HP 26A black toner CF226A $181.99 each. Shipping calculated later.";
  const chosen = chooseVisiblePrice(text, "HP 26A");
  assert.equal(chosen?.cents, 18199);
  assert.equal(chosen?.basis, "near the search words");
  assert.equal(chooseVisiblePrice("No amounts here", "paper"), null);
  assert.equal(chooseVisiblePrice("Free shipping $0.00", "paper"), null);
  const filters = [
    'Results for "HP 26A black toner"',
    "Under $25 (116)",
    "$25-$50 (263)",
    "HP 26A Black Original LaserJet Toner Cartridge",
    "$427.58",
    "$314.99",
    "Advertised Price",
  ].join("\n");
  assert.equal(chooseVisiblePrice(filters, "HP 26A black toner")?.cents, 31499);
});

test("bot walls are reported instead of a price", () => {
  assert.match(detectBlock(200, "Just a moment...", "Verify you are human") || "", /bot check/);
  assert.equal(detectBlock(200, "Shop HP 26A", "HP 26A toner $181.99 in stock today at the warehouse counter."), null);
  assert.match(detectBlock(403, "Access Denied", "no") || "", /403/);
});

test("live recommendation does not award an unverified total", () => {
  const result = recommendLive([
    { vendorId: "quill", name: "Quill", verification: "unverified", lines: [{ query: "HP 26A", unitPriceCents: 18199, note: "first price on the page" }] },
    { vendorId: "cdw", name: "CDW", blocked: true, lines: [] },
  ]);
  assert.match(result.summary, /not a verified award/);
  assert.equal(result.picks[0]?.name, "Quill");
});

test("curated stores keep a closed host list", () => {
  const catalog = loadRealVendors();
  const targets = resolveLiveTargets([{ id: "quill" }, { id: "cdw" }], catalog, true);
  assert.equal(targets.length, 2);
  assert.equal(targets[0]?.allowHosts.includes(".quill.com"), true);
  assert.equal(targets[0]?.allowHosts.includes(".cdw.com"), false);
  assert.equal(JSON.stringify(targets).includes("exfil.evil"), false);
  const custom = resolveLiveTargets([{ name: "Example", url: "https://shop.example.com/toner" }], catalog, true);
  assert.deepEqual(allowRulesForHosts(["example.com"]).includes(".example.com"), true);
  assert.equal(custom[0]?.allowHosts.includes(".example.com"), true);
  assert.throws(() => resolveLiveTargets([{ url: "http://shop.example.com" }], catalog, true));
});
