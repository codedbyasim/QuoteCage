declare module "../../../shared/quote-math.mjs" {
  export function formatUsd(cents: number | null): string;
  export function formatCents(cents: number | null): string;
  export function arithmeticOk(quote: {
    lines: { lineTotalCents: number | null }[];
    shippingCents: number;
    feeCents?: number;
    fees?: { amountCents: number }[];
    totalCents: number;
  }): boolean;
  export function recommend(quotes: {
    vendorId: string;
    totalCents: number;
    complete: boolean;
    tainted: boolean;
  }[]): {
    cheapestVendorId: string | null;
    cheapestCents: number | null;
    bestValueVendorId: string | null;
    bestValueCents: number | null;
    cheapestIsUntrusted: boolean;
  };
  export function explainRecommendation(
    quotes: {
      vendorId: string;
      totalCents: number;
      complete: boolean;
      tainted: boolean;
    }[],
    rec: {
      cheapestVendorId: string | null;
      cheapestCents: number | null;
      bestValueVendorId: string | null;
      bestValueCents: number | null;
      cheapestIsUntrusted: boolean;
    },
    nameOf: (id: string) => string,
  ): string;
}

declare module "../../../shared/planner.mjs" {
  export function planFromBom(text: string, catalog: unknown): { items: { sku: string | null; name: string; qty: number; unit: string; query: string }[]; notes: string };
  export function validatePlan(plan: unknown, catalog: unknown): { items: { sku: string | null; name: string; qty: number; unit: string; query: string }[]; notes: string } | null;
}

declare module "../../../shared/vision.mjs" {
  export function crossCheckVisibleText(input: {
    totalCents: number;
    unitPriceCents: (number | null)[];
    shippingCents: number;
    feeCents: number[];
    visibleText: string;
  }): { match: boolean; missing: string[]; method: string; model: string | null };
}

declare module "../../../shared/policy.mjs" {
  export function decideEgress(rawUrl: string, allowHosts: string[]): { allow: boolean; reason: string; host: string | null };
  export function assertEnvEntriesSafe(entries: string[]): string[];
  export function isContactAction(actionType: string): boolean;
  export function canExecuteContact(): boolean;
}

declare module "../../../shared/approvals.mjs" {
  export function decideApproval<T extends { status: string; actionType: string }>(
    approval: T,
    decision: "approve" | "deny",
  ): T & { status: string; executed: false; note: string };
}
