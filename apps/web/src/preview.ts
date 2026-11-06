import catalog from "../../../shared/catalog.json";
import { explainRecommendation, formatUsd, quoteVendor, recommend } from "../../../shared/quote-math.mjs";

export { catalog, formatUsd };

const officeItems = [
  { sku: "a4-ream", name: "A4 multipurpose paper", qty: 10, unit: "ream" },
  { sku: "hp-26a", name: "HP 26A black toner", qty: 2, unit: "each" },
  { sku: "chair-task", name: "Task chair", qty: 4, unit: "each" },
];

export function officePreview() {
  const quotes = catalog.vendors.map((vendor) => quoteVendor(vendor, officeItems));
  const rec = recommend(quotes);
  const summary = explainRecommendation(quotes, rec, (id) => catalog.vendors.find((vendor) => vendor.id === id)?.name || id);
  return { quotes, rec, summary, items: officeItems };
}
