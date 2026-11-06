const RULES = [
  { sku: "card-12x18", test: (s) => /cardstock|cover stock|12\s*[x×]\s*18/.test(s) },
  { sku: "toner-cyan", test: (s) => /cyan/.test(s) },
  { sku: "hp-26a", test: (s) => /26a|cf226a|hp\s*26/.test(s) },
  { sku: "box-12", test: (s) => /box|mailer/.test(s) },
  { sku: "chair-task", test: (s) => /chair/.test(s) },
  { sku: "a4-ream", test: (s) => /\ba4\b|copy paper|multipurpose paper/.test(s) },
];

function splitBom(text) {
  return text
    .split(/\n|;/)
    .flatMap((line) => line.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseQty(line) {
  const stripped = line.replace(/\d+\s*[x×]\s*\d+/gi, " ");
  const multiplied = stripped.match(/\bx\s*(\d+)\b/i);
  if (multiplied) return clampQty(Number(multiplied[1]));
  const withUnit = stripped.match(/\b(\d+)\s*(reams?|packs?|boxes|sheets|units|each|pcs|chairs?)\b/i);
  if (withUnit) return clampQty(Number(withUnit[1]));
  const any = stripped.match(/\b(\d+)\b/);
  if (any) return clampQty(Number(any[1]));
  return 1;
}

function clampQty(n) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(999, Math.round(n));
}

export function planFromBom(text, catalog) {
  const bySku = new Map(catalog.items.map((item) => [item.sku, item]));
  const merged = new Map();
  const unknown = [];
  for (const line of splitBom(text)) {
    const lowered = line.toLowerCase();
    const rule = RULES.find((candidate) => candidate.test(lowered));
    const qty = parseQty(line);
    if (!rule) {
      unknown.push({ sku: null, name: line, qty, unit: "each", query: line });
      continue;
    }
    const item = bySku.get(rule.sku);
    const prev = merged.get(rule.sku);
    merged.set(rule.sku, {
      sku: rule.sku,
      name: item?.name || rule.sku,
      qty: clampQty((prev?.qty || 0) + qty),
      unit: item?.unit || "each",
      query: item?.name || line,
    });
  }
  return {
    items: [...merged.values(), ...unknown],
    notes: "Quantities and SKUs normalized on the control plane.",
  };
}

export function validatePlan(plan, catalog) {
  if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) return null;
  const known = new Set(catalog.items.map((item) => item.sku));
  const items = [];
  for (const raw of plan.items.slice(0, 12)) {
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return null;
    const sku = raw.sku == null || raw.sku === "" ? null : String(raw.sku);
    if (sku && !known.has(sku)) return null;
    const catalogItem = sku ? catalog.items.find((item) => item.sku === sku) : null;
    const name = catalogItem?.name || String(raw.name || raw.query || "Item").slice(0, 160);
    items.push({
      sku,
      name,
      qty,
      unit: catalogItem?.unit || String(raw.unit || "each"),
      query: catalogItem?.name || String(raw.query || name).slice(0, 200),
    });
  }
  return { items, notes: String(plan.notes || "").slice(0, 500) };
}
