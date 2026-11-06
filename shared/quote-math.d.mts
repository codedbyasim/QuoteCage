export type QuoteLine = {
  sku: string | null;
  name: string;
  qty: number;
  unit: string;
  stock: string;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
  note?: string;
};

export type Quote = {
  vendorId: string;
  lines: QuoteLine[];
  subtotalCents: number;
  shippingCents: number;
  shippingLabel: string;
  fees: { label: string; amountCents: number }[];
  feeCents: number;
  totalCents: number;
  complete: boolean;
  tainted: boolean;
  currency: "USD";
};

export type RecommendationCore = {
  cheapestVendorId: string | null;
  cheapestCents: number | null;
  bestValueVendorId: string | null;
  bestValueCents: number | null;
  cheapestIsUntrusted: boolean;
};

export function formatUsd(cents: number | null): string;
export function formatCents(cents: number | null): string;
export function shippingFor(rule: { type: string; amountCents?: number; freeOverCents?: number; underCents?: number }, subtotalCents: number): number;
export function quoteVendor(vendor: {
  id: string;
  tainted?: boolean;
  shippingLabel?: string;
  shipping: { type: string; amountCents?: number; freeOverCents?: number; underCents?: number; label: string };
  fees?: { label: string; amountCents: number }[];
  prices: Record<string, { priceCents: number; stock: string; note?: string }>;
}, items: { sku: string; name: string; qty: number; unit: string }[]): Quote;
export function recommend(quotes: Quote[]): RecommendationCore;
export function explainRecommendation(quotes: Quote[], rec: RecommendationCore, nameOf: (id: string) => string): string;
export function arithmeticOk(quote: { lines: { lineTotalCents: number | null }[]; shippingCents: number; feeCents?: number; fees?: { amountCents: number }[]; totalCents: number }): boolean;
