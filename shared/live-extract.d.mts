export function detectBlock(status: number, title: string, text: string): string | null;
export function findPrices(text: string): { cents: number; index: number; raw: string }[];
export function chooseVisiblePrice(text: string, query: string): { cents: number; index: number; raw: string; basis: string } | null;
export function recommendLive(vendors: {
  vendorId: string;
  name: string;
  blocked?: boolean;
  verification?: string;
  lines?: { query?: string; name?: string; unitPriceCents?: number | null; note?: string; basis?: string }[];
}[]): { summary: string; picks: { query: string; vendorId: string; name: string; priceCents: number; basis: string; verification: string }[] };
export function registrableHost(hostname: string): string;
export function allowRulesForHosts(hosts: string[]): string[];
