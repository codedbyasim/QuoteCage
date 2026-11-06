export type Plan = { items: { sku: string | null; name: string; qty: number; unit: string; query: string }[]; notes: string };
export function planFromBom(text: string, catalog: unknown): Plan;
export function validatePlan(plan: unknown, catalog: unknown): Plan | null;
