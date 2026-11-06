export function crossCheckVisibleText(input: {
  totalCents: number;
  unitPriceCents: (number | null)[];
  shippingCents: number;
  feeCents: number[];
  visibleText: string;
}): { match: boolean; missing: string[]; method: string; model: string | null };
