function norm(value) {
  return String(value)
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value) {
  return norm(value)
    .split(/\s+/)
    .filter((token) => token && !["the", "a", "of", "and", "for"].includes(token));
}

function tokenHit(hay, token) {
  if (hay.has(token)) return true;
  if (token.endsWith("s") && hay.has(token.slice(0, -1))) return true;
  if (token.endsWith("es") && hay.has(token.slice(0, -2))) return true;
  return false;
}

export function searchVendor(catalog, vendor, query) {
  const wanted = tokens(query);
  const priced = catalog.items.filter((item) => vendor.prices[item.sku]);
  if (wanted.length === 0) return priced;
  return priced.filter((item) => {
    const hay = new Set(tokens([item.sku, item.name, item.detail, ...(item.aliases || [])].join(" ")));
    return wanted.every((token) => tokenHit(hay, token));
  });
}
