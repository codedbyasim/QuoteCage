import type { Repository } from "./db.js";
import type { Catalog, Quote, QuoteLine } from "./types.js";

function asQuote(vendorId: string, result: Record<string, unknown> | null): Quote | null {
  if (!result || !Number.isInteger(result.totalCents)) return null;
  const lines = Array.isArray(result.lines) ? (result.lines as QuoteLine[]) : [];
  return {
    vendorId,
    lines,
    subtotalCents: Number(result.subtotalCents ?? 0),
    shippingCents: Number(result.shippingCents ?? 0),
    shippingLabel: String(result.shippingLabel || "Shipping"),
    fees: Array.isArray(result.fees) ? (result.fees as Quote["fees"]) : [],
    feeCents: Number(result.feeCents ?? 0),
    totalCents: Number(result.totalCents),
    complete: Boolean(result.complete),
    tainted: Boolean(result.tainted),
    currency: "USD",
  };
}

export function presentRun(repo: Repository, catalog: Catalog, runId: string) {
  const run = repo.getRun(runId);
  if (!run) return null;
  const evidence = repo.listEvidence(runId);
  const vendors = repo.listVendors(runId).map((vendor) => {
    const meta = catalog.vendors.find((entry) => entry.id === vendor.vendorId);
    const result = vendor.result;
    return {
      vendorId: vendor.vendorId,
      name: vendor.name || meta?.name || vendor.vendorId,
      tagline: meta?.tagline || "",
      shippingLabel: meta?.shippingLabel || (typeof result?.shippingLabel === "string" ? result.shippingLabel : ""),
      status: vendor.status,
      error: vendor.error,
      containerId: vendor.containerId,
      destroyed: vendor.destroyed,
      sandbox: vendor.sandbox,
      quote: asQuote(vendor.vendorId, result),
      vision: vendor.vision,
      screenshots: evidence
        .filter((item) => item.vendor_id === vendor.vendorId && item.filename.endsWith(".png"))
        .map((item) => ({
          filename: item.filename,
          sha256: item.sha256,
          bytes: item.bytes,
          label: labelFor(item.filename, result),
          url: `/api/runs/${runId}/evidence/${vendor.vendorId}/${item.filename}`,
        })),
      egress: Array.isArray(result?.egress) ? result.egress : [],
      injectionExcerpts: Array.isArray(result?.injectionExcerpts) ? result.injectionExcerpts : [],
      networkProbe: result?.networkProbe ?? null,
      refusals: Array.isArray(result?.refusals) ? result.refusals : [],
    };
  });
  return {
    id: run.id,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    status: run.status,
    bomText: run.bomText,
    vendorIds: run.vendorIds,
    plan: run.plan,
    inference: run.inference,
    recommendation: run.recommendation,
    containment: run.containment,
    error: run.error,
    vendors,
    approvals: repo.listApprovals(runId),
    evidence: evidence.map((item) => ({
      vendorId: item.vendor_id,
      filename: item.filename,
      sha256: item.sha256,
      bytes: item.bytes,
    })),
    events: repo.listEvents(runId),
  };
}

function labelFor(filename: string, result: Record<string, unknown> | null) {
  const shots = Array.isArray(result?.screenshots) ? (result.screenshots as { file: string; label: string }[]) : [];
  return shots.find((shot) => shot.file === filename)?.label || filename;
}
