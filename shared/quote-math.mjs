export function formatCents(cents) {
  if (cents == null || Number.isNaN(cents)) return "—";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  return `${sign}${dollars}.${rem}`;
}

export function formatUsd(cents) {
  if (cents == null || Number.isNaN(cents)) return "—";
  return `$${formatCents(cents)}`;
}

export function shippingFor(rule, subtotalCents) {
  if (!rule) return 0;
  if (rule.type === "flat") return rule.amountCents;
  if (rule.type === "threshold") {
    return subtotalCents >= rule.freeOverCents ? 0 : rule.underCents;
  }
  throw new Error(`Unknown shipping rule ${rule.type}`);
}

export function quoteVendor(vendor, items) {
  const lines = items.map((item) => {
    const price = vendor.prices[item.sku];
    if (!price) {
      return {
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        stock: "not_found",
        unitPriceCents: null,
        lineTotalCents: null,
        note: "Not in this catalog",
      };
    }
    const inStock = price.stock === "in_stock";
    return {
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      stock: price.stock,
      unitPriceCents: price.priceCents,
      lineTotalCents: inStock ? price.priceCents * item.qty : null,
      note: price.note || "",
    };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0);
  const shippingCents = shippingFor(vendor.shipping, subtotalCents);
  const fees = vendor.fees || [];
  const feeCents = fees.reduce((sum, fee) => sum + fee.amountCents, 0);
  const complete = lines.length > 0 && lines.every((line) => line.stock === "in_stock");
  return {
    vendorId: vendor.id,
    lines,
    subtotalCents,
    shippingCents,
    shippingLabel: vendor.shipping?.label || vendor.shippingLabel || "Shipping",
    fees,
    feeCents,
    totalCents: subtotalCents + shippingCents + feeCents,
    complete,
    tainted: Boolean(vendor.tainted),
    currency: "USD",
  };
}

export function recommend(quotes) {
  const priced = quotes.filter((quote) => quote.complete && Number.isInteger(quote.totalCents));
  const byTotal = (a, b) => a.totalCents - b.totalCents || a.vendorId.localeCompare(b.vendorId);
  const cheapest = priced.slice().sort(byTotal)[0] || null;
  const best = priced.filter((quote) => !quote.tainted).slice().sort(byTotal)[0] || null;
  return {
    cheapestVendorId: cheapest?.vendorId ?? null,
    cheapestCents: cheapest?.totalCents ?? null,
    bestValueVendorId: best?.vendorId ?? null,
    bestValueCents: best?.totalCents ?? null,
    cheapestIsUntrusted: Boolean(cheapest && cheapest.tainted && cheapest.vendorId !== best?.vendorId),
  };
}

export function explainRecommendation(quotes, rec, nameOf) {
  if (!rec.bestValueVendorId) {
    return "No vendor can fill every line without a security hold.";
  }
  const bestName = nameOf(rec.bestValueVendorId);
  const best = formatUsd(rec.bestValueCents);
  if (rec.cheapestIsUntrusted && rec.cheapestVendorId) {
    const cheapName = nameOf(rec.cheapestVendorId);
    const cheap = formatUsd(rec.cheapestCents);
    const others = quotes
      .filter((quote) => quote.complete && !quote.tainted && quote.vendorId !== rec.bestValueVendorId)
      .sort((a, b) => a.totalCents - b.totalCents);
    const versus = others.length > 0
      ? `, ${formatUsd(others[0].totalCents - rec.bestValueCents)} less than ${nameOf(others[0].vendorId)} on this list`
      : "";
    return `${bestName} is the lowest total that can ship every line and did not trip containment (${best})${versus}. ${cheapName} shows ${cheap}, and that result is held because the page tried to redirect the agent.`;
  }
  const others = quotes
    .filter((quote) => quote.complete && !quote.tainted && quote.vendorId !== rec.bestValueVendorId)
    .sort((a, b) => a.totalCents - b.totalCents);
  if (others.length > 0) {
    const next = others[0];
    const delta = next.totalCents - rec.bestValueCents;
    return `${bestName} is the lowest total that can ship every line (${best}), ${formatUsd(delta)} under ${nameOf(next.vendorId)} on this list.`;
  }
  return `${bestName} is the lowest total that can ship every line (${best}).`;
}

export function arithmeticOk(quote) {
  const lines = quote.lines.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0);
  const fees = quote.feeCents ?? (quote.fees || []).reduce((sum, fee) => sum + fee.amountCents, 0);
  return lines + quote.shippingCents + fees === quote.totalCents;
}
