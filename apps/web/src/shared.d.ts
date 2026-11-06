declare module "../../../shared/quote-math.mjs" {
  export function formatUsd(cents: number | null): string;
  export function quoteVendor(
    vendor: {
      id: string;
      tainted?: boolean;
      shippingLabel?: string;
      shipping: { type: string; amountCents?: number; freeOverCents?: number; underCents?: number; label: string };
      fees?: { label: string; amountCents: number }[];
      prices: Record<string, { priceCents: number; stock: string; note?: string }>;
    },
    items: { sku: string; name: string; qty: number; unit: string }[],
  ): {
    vendorId: string;
    totalCents: number;
    complete: boolean;
    tainted: boolean;
    shippingCents: number;
  };
  export function recommend(quotes: { vendorId: string; totalCents: number; complete: boolean; tainted: boolean }[]): {
    cheapestVendorId: string | null;
    cheapestCents: number | null;
    bestValueVendorId: string | null;
    bestValueCents: number | null;
    cheapestIsUntrusted: boolean;
  };
  export function explainRecommendation(
    quotes: { vendorId: string; totalCents: number; complete: boolean; tainted: boolean }[],
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
