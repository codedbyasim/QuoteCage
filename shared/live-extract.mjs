const BLOCK_TEXT = /just a moment|verify you are|are you a human|access denied|unusual traffic|pardon our interruption|security verification|captcha|sorry! something went wrong|enable javascript and cookies/i;

export function detectBlock(status, title, text) {
  if (status === 401 || status === 403 || status === 429 || status === 503) {
    return `The site responded ${status}.`;
  }
  const sample = `${title || ""}\n${text || ""}`.slice(0, 4000);
  if (BLOCK_TEXT.test(sample)) return "The site showed a bot check or an error wall.";
  if ((text || "").trim().length < 40) return "The page did not render readable text.";
  return null;
}

export function findPrices(text) {
  const prices = [];
  const re = /\$\s?(\d{1,5})(?:\.(\d{2}))?/g;
  for (const match of String(text || "").matchAll(re)) {
    const dollars = Number(match[1]);
    const cents = match[2] == null ? 0 : Number(match[2]);
    const amount = dollars * 100 + cents;
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10000000) continue;
    prices.push({ cents: amount, index: match.index ?? 0, raw: match[0].replace(/\s+/g, "") });
  }
  return prices;
}

function isFilterBucket(text, price) {
  const before = text.slice(Math.max(0, price.index - 30), price.index);
  const after = text.slice(price.index + price.raw.length, price.index + price.raw.length + 20);
  if (/under\s*$/i.test(before)) return true;
  if (/\$\s?\d[\d,]*(?:\.\d{2})?\s*[-–]\s*$/.test(before)) return true;
  if (/^\s*[-–]\s*\$/.test(after)) return true;
  if (/^\s*\(\d+\)/.test(after)) return true;
  return false;
}

function preferAdvertised(text, price, prices) {
  const next = prices.find((item) => item.index > price.index && item.index - price.index < 48);
  if (!next) return price;
  const span = text.slice(price.index, next.index + next.raw.length + 28);
  if (/advertised price/i.test(span)) return next;
  return price;
}

export function chooseVisiblePrice(text, query) {
  const haystack = String(text || "");
  const prices = findPrices(haystack).filter((price) => !isFilterBucket(haystack, price));
  if (prices.length === 0) return null;
  const needle = String(query || "").trim().toLowerCase();
  let chosen = prices[0];
  let basis = "first price on the page";
  if (needle.length >= 3) {
    const at = haystack.toLowerCase().indexOf(needle);
    if (at >= 0) {
      const near = prices.find((price) => price.index >= at && price.index <= at + 4000);
      if (near) {
        chosen = near;
        basis = "near the search words";
      }
    }
  }
  chosen = preferAdvertised(haystack, chosen, prices);
  return { ...chosen, basis };
}

export function recommendLive(vendors) {
  const lines = new Map();
  for (const vendor of vendors) {
    if (vendor.blocked) continue;
    for (const line of vendor.lines || []) {
      if (!Number.isInteger(line.unitPriceCents)) continue;
      const key = line.query || line.name;
      const current = lines.get(key);
      if (!current || line.unitPriceCents < current.priceCents) {
        lines.set(key, {
          query: key,
          vendorId: vendor.vendorId,
          name: vendor.name,
          priceCents: line.unitPriceCents,
          basis: line.note || line.basis || "",
          verification: vendor.verification || "unverified",
        });
      }
    }
  }
  const picks = [...lines.values()];
  const verified = picks.filter((pick) => pick.verification === "verified");
  if (picks.length === 0) {
    return {
      summary: vendors.some((vendor) => vendor.blocked)
        ? "No readable price. At least one site blocked the browser or showed an error wall. Nothing was filled in."
        : "No readable price was on the pages that opened. Nothing was filled in.",
      picks: [],
    };
  }
  if (verified.length === 0) {
    return {
      summary: "Prices below were read from the page text. A vision model did not confirm the screenshot, so this is not a verified award.",
      picks,
    };
  }
  const bits = verified.map((pick) => `${pick.name} showed ${formatDollars(pick.priceCents)} for “${pick.query}”`);
  return {
    summary: `Verified from the screenshot and the page text: ${bits.join("; ")}. This is not a freight-inclusive cart and no order was placed.`,
    picks,
  };
}

function formatDollars(cents) {
  const dollars = Math.floor(cents / 100);
  const rem = String(cents % 100).padStart(2, "0");
  return `$${dollars}.${rem}`;
}

export function registrableHost(hostname) {
  const parts = String(hostname || "").toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const tail = parts.slice(-2).join(".");
  const three = new Set(["co.uk", "com.au", "co.nz", "com.br", "co.jp"]);
  if (three.has(tail) && parts.length >= 3) return parts.slice(-3).join(".");
  return tail;
}

export function allowRulesForHosts(hosts) {
  const rules = [];
  for (const host of hosts) {
    const name = String(host || "").toLowerCase().replace(/^\*\./, "").replace(/^\./, "");
    if (!name || !/^[a-z0-9.-]+$/.test(name)) continue;
    rules.push(`.${name}`);
  }
  return [...new Set(rules)];
}
