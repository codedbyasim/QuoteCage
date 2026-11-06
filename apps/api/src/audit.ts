import { readFileSync } from "node:fs";
import type { Repository } from "./db.js";
import type { Catalog } from "./types.js";
import { presentRun } from "./present.js";
import { zipStore } from "./zip.js";

export function buildAudit(repo: Repository, catalog: Catalog, runId: string) {
  const run = presentRun(repo, catalog, runId);
  if (!run) return null;
  return {
    schema: "quotecage.audit.v1",
    runId: run.id,
    createdAt: run.createdAt,
    status: run.status,
    bom: run.bomText,
    inference: run.inference,
    plan: run.plan,
    recommendation: run.recommendation,
    containment: run.containment,
    vendors: run.vendors.map((vendor) => ({
      vendorId: vendor.vendorId,
      name: vendor.name,
      status: vendor.status,
      error: vendor.error,
      containerId: vendor.containerId,
      destroyed: vendor.destroyed,
      sandbox: vendor.sandbox,
      quote: vendor.quote,
      vision: vendor.vision,
      egress: vendor.egress,
      injectionExcerpts: vendor.injectionExcerpts,
      networkProbe: vendor.networkProbe,
      refusals: vendor.refusals,
    })),
    approvals: run.approvals,
    events: run.events,
    evidence: run.evidence.map((item) => ({
      vendorId: item.vendorId,
      filename: item.filename,
      sha256: item.sha256,
      bytes: item.bytes,
    })),
  };
}

export function buildEvidenceZip(repo: Repository, catalog: Catalog, runId: string) {
  const audit = buildAudit(repo, catalog, runId);
  if (!audit) return null;
  const files = [
    {
      name: "README.txt",
      data: Buffer.from(
        "QuoteCage evidence pack.\nSHA-256 values in audit.json are of the screenshot and result files in this archive.\nThe product did not place an order.\n",
      ),
    },
    { name: "audit.json", data: Buffer.from(JSON.stringify(audit, null, 2)) },
  ];
  for (const item of repo.listEvidence(runId)) {
    const safeVendor = item.vendor_id.replace(/[^a-z0-9-]+/gi, "");
    const safeName = item.filename.replace(/[^a-z0-9._-]+/gi, "");
    files.push({
      name: `evidence/${safeVendor}/${safeName}`,
      data: readFileSync(item.path),
    });
  }
  return zipStore(files);
}
