import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allowRulesForHosts, registrableHost } from "../../../shared/live-extract.mjs";
import { decideEgress } from "../../../shared/policy.mjs";

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

export type RealStore = {
  id: string;
  name: string;
  blurb: string;
  url: string;
  search: string;
  hosts: string[];
};

type RealCatalog = { assetSuffixes: string[]; exampleBom: string; stores: RealStore[] };

export function loadRealVendors(): RealCatalog {
  const path = fileURLToPath(new URL("../../../shared/real-vendors.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as RealCatalog;
}

export type LiveTarget = {
  id: string;
  name: string;
  baseUrl: string;
  host: string;
  searchTemplate: string | null;
  allowHosts: string[];
};

export function resolveLiveTargets(
  input: { id?: string; name?: string; url?: string }[],
  catalog: RealCatalog,
  allowCustom: boolean,
): LiveTarget[] {
  if (!allowCustom && input.some((vendor) => !vendor.id || !catalog.stores.some((store) => store.id === vendor.id))) {
    throw httpError(403, "Custom store URLs are off. Pick a listed store, or set ALLOW_LIVE_URLS=true.");
  }
  return input.map((vendor) => {
    const curated = vendor.id ? catalog.stores.find((store) => store.id === vendor.id) : undefined;
    if (curated && !vendor.url) return targetFromStore(curated, catalog.assetSuffixes);
    if (curated && vendor.url) {
      const url = parseHttps(vendor.url);
      if (registrableHost(url.hostname) !== registrableHost(new URL(curated.url).hostname)) {
        throw httpError(400, `${curated.name} only opens on its own site.`);
      }
      return { ...targetFromStore(curated, catalog.assetSuffixes), baseUrl: url.href, host: url.hostname };
    }
    const url = parseHttps(String(vendor.url || ""));
    const decision = decideEgress(url.href, ["placeholder.invalid"]);
    if (decision.reason === "blocked_host" || decision.reason === "ip_literal" || decision.reason === "scheme" || decision.reason === "bad_url") {
      throw httpError(400, "That address cannot be opened.");
    }
    const hosts = [registrableHost(url.hostname), ...catalog.assetSuffixes];
    return {
      id: `live-${registrableHost(url.hostname).replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
      name: String(vendor.name || url.hostname).trim().slice(0, 80),
      baseUrl: url.href,
      host: url.hostname,
      searchTemplate: null,
      allowHosts: allowRulesForHosts(hosts),
    };
  });
}

function targetFromStore(store: RealStore, assetSuffixes: string[]): LiveTarget {
  const url = new URL(store.url);
  return {
    id: store.id,
    name: store.name,
    baseUrl: store.url,
    host: url.hostname,
    searchTemplate: store.search,
    allowHosts: allowRulesForHosts([...store.hosts, ...assetSuffixes]),
  };
}

function parseHttps(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw httpError(400, "Enter a full https:// store or product link.");
  }
  if (url.protocol !== "https:") throw httpError(400, "Real stores have to be https links.");
  return url;
}

export function rfqDraft(vendorName: string, items: { qty?: number; name?: string }[]) {
  const lines = items.length
    ? items.map((item) => `- ${item.qty || 1} x ${item.name || "Item"}`).join("\n")
    : "- (see the shopping list)";
  return `Subject: Request for quote\n\nHello ${vendorName},\n\nPlease send a written quote, including freight and whether each line is in stock:\n${lines}\n\nQuoteCage drafted this for a person to copy. It was not sent, and no order was placed.`;
}
