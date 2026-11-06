import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const port = process.env.HTTP_PORT || "8088";
const base = process.env.QUOTECAGE_URL || `http://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return response.json();
    } catch {
      // The proxy is still coming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`No health response from ${base}`);
}

async function waitForRun(id) {
  const started = Date.now();
  while (Date.now() - started < 420000) {
    const response = await fetch(`${base}/api/runs/${id}`);
    const run = await response.json();
    if (run.status === "complete" || run.status === "failed") return run;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Run did not finish.");
}

const health = await waitForHealth();
console.log("health", health.inferenceMode);
const created = await fetch(`${base}/api/runs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    bomText: "A4 paper 10 reams, toner HP 26A x2, office chairs x4",
    vendorIds: ["reedmill", "brightcartridge", "oakline", "quickquote"],
  }),
});
assert(created.status === 201, `create failed ${created.status}`);
const { id } = await created.json();
const run = await waitForRun(id);
if (run.status !== "complete") {
  console.error(JSON.stringify(run.vendors?.map((vendor) => ({ id: vendor.vendorId, status: vendor.status, error: vendor.error })), null, 2));
  throw new Error(run.error || "run failed");
}

assert(run.recommendation?.bestValueVendorId === "oakline", `best value was ${run.recommendation?.bestValueVendorId}`);
assert(run.recommendation?.cheapestVendorId === "quickquote", "cheapest fixture was not QuickQuote");
const hostile = run.vendors.find((vendor) => vendor.vendorId === "quickquote");
assert(hostile?.quote?.tainted === true, "QuickQuote was not marked tainted");
assert((hostile.egress || []).length > 0, "no egress denial was recorded");
assert(hostile.networkProbe?.directInternetReachable === false, "sandbox reached the public internet directly");
assert(run.containment?.secretsInSandbox === 0, "sandbox reported a secret");
assert(run.approvals.some((approval) => approval.actionType === "send_email" && approval.status === "pending"), "email action was not waiting");
assert(run.events.some((event) => event.kind === "sandbox_destroyed" && event.data?.stillPresent === false), "a sandbox was not destroyed");
assert(run.events.some((event) => event.kind === "egress_denied"), "timeline missed egress_denied");
const createdEvent = run.events.find((event) => event.kind === "sandbox_created");
assert(createdEvent?.data?.readonlyRootfs === true, "sandbox was not read-only");
assert((createdEvent?.data?.capDrop || []).includes("ALL"), "capabilities were not dropped");
assert(!(createdEvent?.data?.envNames || []).includes("VULTR_INFERENCE_API_KEY"), "inference key name was in the sandbox");

const shot = run.vendors.flatMap((vendor) => vendor.screenshots)[0];
assert(shot, "no screenshot");
assert(/^[a-f0-9]{64}$/.test(shot.sha256), "sha256 shape");
const png = Buffer.from(await (await fetch(`${base}${shot.url}`)).arrayBuffer());
assert(createHash("sha256").update(png).digest("hex") === shot.sha256, "screenshot hash mismatch");

const email = run.approvals.find((approval) => approval.actionType === "send_email");
const denied = await fetch(`${base}/api/approvals/${email.id}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ decision: "deny" }),
});
const denial = await denied.json();
assert(denial.status === "denied" && denial.executed === false, "deny did not stick");

const audit = await (await fetch(`${base}/api/runs/${id}/audit`)).json();
assert(audit.schema === "quotecage.audit.v1", "audit schema");
assert(!JSON.stringify(audit).includes("VULTR_INFERENCE_API_KEY="), "audit contained a key assignment");

const localDocker = ["127.0.0.1", "localhost", "::1"].includes(new URL(base).hostname);
if (localDocker) {
  const leftover = execFileSync("sudo", ["docker", "ps", "-aq", "--filter", "label=quotecage.role=sandbox"], { encoding: "utf8" }).trim();
  assert(leftover === "", `sandbox containers still present:\n${leftover}`);
} else {
  console.log("QUOTECAGE_URL is remote; skipping the local docker process check");
}
console.log(`e2e ok ${base}/app/${id}`);
