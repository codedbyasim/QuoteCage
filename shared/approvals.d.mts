export function decideApproval<T extends { status: string; actionType: string }>(
  approval: T,
  decision: "approve" | "deny",
): T & { status: string; executed: false; note: string };
