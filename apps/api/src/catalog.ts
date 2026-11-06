import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Catalog } from "./types.js";

export function loadCatalog(): Catalog {
  const path = fileURLToPath(new URL("../../../shared/catalog.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Catalog;
}

export function fixtureHosts(catalog: Catalog): string[] {
  return catalog.vendors.map((vendor) => vendor.host);
}
