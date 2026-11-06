function attrs(tag) {
  const out = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[match[1]] = match[2];
  return out;
}

export function readCartContract(html) {
  const section = html.match(/<section\b[^>]*id="qc-cart"[^>]*>/i);
  if (!section) return null;
  const root = attrs(section[0]);
  const num = (value) => (value == null || value === "" ? null : Number(value));
  const lines = [];
  for (const match of html.matchAll(/<li\b[^>]*\bdata-qc-line\b[^>]*>/gi)) {
    const tag = attrs(match[0]);
    lines.push({
      sku: tag["data-sku"] || null,
      name: tag["data-name"] || null,
      qty: Number(tag["data-qty"]),
      unit: tag["data-unit"] || null,
      stock: tag["data-stock"] || null,
      unitPriceCents: num(tag["data-unit-price-cents"]),
      lineTotalCents: num(tag["data-line-total-cents"]),
    });
  }
  const fees = [];
  for (const match of html.matchAll(/<p\b[^>]*\bdata-qc-fee\b[^>]*>/gi)) {
    const tag = attrs(match[0]);
    fees.push({ label: tag["data-label"] || "", amountCents: Number(tag["data-amount-cents"]) });
  }
  return {
    subtotalCents: Number(root["data-qc-subtotal-cents"]),
    shippingCents: Number(root["data-qc-shipping-cents"]),
    feeCents: Number(root["data-qc-fees-cents"]),
    totalCents: Number(root["data-qc-total-cents"]),
    complete: root["data-qc-complete"] === "true",
    tainted: root["data-qc-tainted"] === "true",
    lines,
    fees,
  };
}
