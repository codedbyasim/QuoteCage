export type PlanItem = { sku: string | null; name: string; qty: number; unit: string; query: string };

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

export type SandboxInspect = {
  id?: string | null;
  user?: string | null;
  memory?: number | null;
  nanoCpus?: number | null;
  pidsLimit?: number | null;
  readonlyRootfs?: boolean | null;
  capDrop?: string[];
  securityOpt?: string[];
  networkMode?: string | null;
  runtime?: string | null;
  privileged?: boolean;
  envNames?: string[];
  secretsInEnv?: number;
};

export type VendorView = {
  vendorId: string;
  name: string;
  tagline: string;
  shippingLabel: string;
  status: string;
  error: string | null;
  containerId: string | null;
  destroyed: boolean;
  sandbox: SandboxInspect | null;
  quote: Quote | null;
  vision: { match?: boolean; text?: { method?: string; match?: boolean }; model?: { method?: string; model?: string; match?: boolean; notes?: string } | null; modelError?: string | null } | null;
  screenshots: { filename: string; sha256: string; bytes: number; label: string; url: string }[];
  egress: { url: string; reason: string }[];
  injectionExcerpts: string[];
  networkProbe: { directInternetReachable?: boolean; fixtureReachable?: boolean } | null;
  refusals: string[];
};

export type Approval = {
  id: string;
  runId: string;
  vendorId: string;
  actionType: string;
  summary: string;
  status: "pending" | "approved_not_sent" | "denied";
  source: string;
  note: string | null;
  executed: false;
};

export type RunEvent = { id: number; ts: string; kind: string; message: string; data: unknown };

export type RunView = {
  id: string;
  createdAt: string;
  status: string;
  bomText: string;
  error: string | null;
  plan: { items: PlanItem[]; notes: string } | null;
  inference: { mode?: string; runMode?: string; plannerModel?: string | null; visionModel?: string | null; fallback?: string | null; keyPresent?: boolean } | null;
  recommendation: {
    cheapestVendorId: string | null;
    cheapestCents: number | null;
    bestValueVendorId: string | null;
    bestValueCents: number | null;
    cheapestIsUntrusted: boolean;
    summary: string;
  } | null;
  containment: {
    sandboxes?: { vendorId: string; destroyed?: boolean; runtime?: string; containerId?: string | null }[];
    secretsInSandbox?: number;
    runtimeNote?: string | null;
    memoryBytes?: number;
    cpus?: number;
    pids?: number;
    network?: string;
    user?: string;
  } | null;
  vendors: VendorView[];
  approvals: Approval[];
  evidence: { vendorId: string; filename: string; sha256: string; bytes: number }[];
  events: RunEvent[];
};

export type VendorOption = { id: string; name: string; tagline: string; shippingLabel: string; fixture: boolean };
export type Sample = { id: string; title: string; blurb: string; bom: string };
