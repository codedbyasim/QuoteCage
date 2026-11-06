import { formatCents } from "./quote-math.mjs";

export function crossCheckVisibleText({ totalCents, unitPriceCents, shippingCents, feeCents, visibleText }) {
  const needles = [formatCents(totalCents)];
  for (const cents of unitPriceCents || []) {
    if (cents != null) needles.push(formatCents(cents));
  }
  if (shippingCents) needles.push(formatCents(shippingCents));
  for (const cents of feeCents || []) {
    if (cents) needles.push(formatCents(cents));
  }
  const missing = needles.filter((needle) => !visibleText.includes(needle));
  return {
    match: missing.length === 0,
    missing,
    method: "deterministic_text_crosscheck",
    model: null,
  };
}
