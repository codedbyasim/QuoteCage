export type CatalogItem = {
  sku: string;
  name: string;
  unit: string;
  detail: string;
  aliases: string[];
};

export type ShippingRule =
  | { type: "flat"; amountCents: number; label: string }
  | { type: "threshold"; freeOverCents: number; underCents: number; label: string };

export type CatalogVendor = {
  id: string;
  name: string;
  host: string;
  tagline: string;
  city: string;
  shippingLabel: string;
  tainted: boolean;
  shipping: ShippingRule;
  fees: { label: string; amountCents: number }[];
  prices: Record<string, { priceCents: number; stock: string; note?: string }>;
};

export type Catalog = {
  items: CatalogItem[];
  samples: { id: string; title: string; blurb: string; bom: string }[];
  vendors: CatalogVendor[];
};

export type PlanItem = {
  sku: string | null;
  name: string;
  qty: number;
  unit: string;
  query: string;
};

export type Plan = { items: PlanItem[]; notes: string };

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
  totalCents: number | null;
  complete: boolean;
  tainted: boolean;
  currency: "USD";
  live?: boolean;
  blocked?: boolean;
  blockReason?: string | null;
  verification?: string;
};

export type Recommendation = {
  cheapestVendorId: string | null;
  cheapestCents: number | null;
  bestValueVendorId: string | null;
  bestValueCents: number | null;
  cheapestIsUntrusted: boolean;
  summary: string;
};

export type ApprovalStatus = "pending" | "approved_not_sent" | "denied";

export type Approval = {
  id: string;
  runId: string;
  vendorId: string;
  actionType: string;
  summary: string;
  status: ApprovalStatus;
  source: string;
  createdAt: string;
  decidedAt: string | null;
  note: string | null;
  executed: false;
};

export type RunEvent = {
  id: number;
  runId: string;
  ts: string;
  kind: string;
  message: string;
  data: unknown;
};
