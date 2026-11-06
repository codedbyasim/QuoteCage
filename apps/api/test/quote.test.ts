import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { explainRecommendation, quoteVendor, recommend } from "../../../shared/quote-math.mjs";

const catalog = JSON.parse(readFileSync(new URL("../../../shared/catalog.json", import.meta.url), "utf8"));
const office = [
  { sku: "a4-ream", name: "A4 multipurpose paper", qty: 10, unit: "ream" },
  { sku: "hp-26a", name: "HP 26A black toner", qty: 2, unit: "each" },
  { sku: "chair-task", name: "Task chair", qty: 4, unit: "each" },
];
const printShop = [
  { sku: "card-12x18", name: "12×18 cardstock", qty: 4, unit: "pack" },
  { sku: "toner-cyan", name: "Cyan toner", qty: 2, unit: "each" },
  { sku: "box-12", name: "12×12 shipping box", qty: 20, unit: "each" },
];

function quotesFor(items) {
  return catalog.vendors.map((vendor) => quoteVendor(vendor, items));
}

test("office sample prices, freight, and the held bait vendor", () => {
  const quotes = quotesFor(office);
  const byId = Object.fromEntries(quotes.map((quote) => [quote.vendorId, quote]));
  assert.equal(byId.reedmill.totalCents, 98800);
  assert.equal(byId.reedmill.complete, true);
  assert.equal(byId.brightcartridge.complete, false);
  assert.equal(byId.brightcartridge.lines.find((line) => line.sku === "chair-task").stock, "out_of_stock");
  assert.equal(byId.oakline.totalCents, 89550);
  assert.equal(byId.oakline.shippingCents, 2500);
  assert.equal(byId.quickquote.totalCents, 77800);
  assert.equal(byId.quickquote.feeCents, 4500);
  assert.equal(byId.quickquote.tainted, true);
  const rec = recommend(quotes);
  assert.equal(rec.bestValueVendorId, "oakline");
  assert.equal(rec.cheapestVendorId, "quickquote");
  assert.equal(rec.cheapestIsUntrusted, true);
  const summary = explainRecommendation(quotes, rec, (id) => catalog.vendors.find((vendor) => vendor.id === id).name);
  assert.match(summary, /Oakline Interiors/);
  assert.match(summary, /QuickQuote Depot/);
  assert.match(summary, /\$92\.50/);
});

test("print shop sample recommends the vendor that can fill every line", () => {
  const quotes = quotesFor(printShop);
  const rec = recommend(quotes);
  assert.equal(rec.bestValueVendorId, "brightcartridge");
  assert.equal(rec.bestValueCents, 26300);
  assert.equal(quotes.find((quote) => quote.vendorId === "oakline").complete, false);
});
