export function decideEgress(rawUrl: string, allowHosts: string[]): { allow: boolean; reason: string; host: string | null };
export function assertEnvEntriesSafe(entries: string[]): string[];
export function isContactAction(actionType: string): boolean;
export function canExecuteContact(): boolean;
