import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.ts";
import { createRepository, openDatabase } from "../src/db.ts";
import { buildApp } from "../src/index.ts";

function makeApp(extra: Record<string, string> = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "quotecage-"));
  const config = loadConfig({
    ...process.env,
    DATA_DIR: dir,
    WORK_DIR: path.join(dir, "work"),
    HOST_WORK_DIR: path.join(dir, "work"),
    ALLOW_DIR: path.join(dir, "allow"),
    INFERENCE_MODE: "mock",
    VULTR_INFERENCE_API_KEY: "",
    DEMO_PASSWORD: "",
    ALLOW_LIVE_URLS: "false",
    ...extra,
  });
  const repo = createRepository(openDatabase(path.join(dir, "test.sqlite")));
  const app = buildApp({ config, repo, docker: null });
  return { app, repo };
}

async function waitFor(fn: () => Promise<boolean>) {
  for (let i = 0; i < 40; i += 1) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("timed out");
}

test("health, vendor list, mock run, and approval gate", async () => {
  const { app } = makeApp();
  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().inferenceMode, "mock");
  assert.equal(health.json().keyPresent, false);

  const vendors = await app.inject({ method: "GET", url: "/api/vendors" });
  assert.equal(vendors.statusCode, 200);
  const body = vendors.json();
  assert.equal(body.vendors.length, 4);
  assert.equal(JSON.stringify(body).includes("priceCents"), false);

  const created = await app.inject({
    method: "POST",
    url: "/api/runs",
    payload: {
      bomText: "A4 paper 10 reams, toner HP 26A x2, office chairs x4",
      vendorIds: ["reedmill", "brightcartridge", "oakline", "quickquote"],
    },
  });
  assert.equal(created.statusCode, 201);
  const id = created.json().id as string;
  await waitFor(async () => {
    const response = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    return response.json().status === "complete" || response.json().status === "failed";
  });
  const run = (await app.inject({ method: "GET", url: `/api/runs/${id}` })).json();
  assert.equal(run.status, "complete");
  assert.equal(run.inference.mode, "mock");
  assert.equal(run.plan.items.length, 3);
  assert.equal(run.vendors.every((vendor: { status: string }) => vendor.status === "failed"), true);

  const blocked = await app.inject({
    method: "POST",
    url: "/api/runs",
    payload: { bomText: "paper", vendorIds: ["reedmill"], liveVendors: [{ name: "Example", url: "https://example.com" }] },
  });
  assert.equal(blocked.statusCode, 403);

  const quote = await app.inject({
    method: "POST",
    url: `/api/runs/${id}/approvals`,
    payload: { vendorId: "reedmill", action: "request_quote" },
  });
  assert.equal(quote.statusCode, 201);
  const approvalId = quote.json().id as string;
  const denied = await app.inject({ method: "POST", url: `/api/approvals/${approvalId}`, payload: { decision: "deny" } });
  assert.equal(denied.statusCode, 200);
  assert.equal(denied.json().status, "denied");
  assert.equal(denied.json().executed, false);
  const again = await app.inject({ method: "POST", url: `/api/approvals/${approvalId}`, payload: { decision: "approve" } });
  assert.equal(again.statusCode, 400);

  const approved = await app.inject({
    method: "POST",
    url: `/api/runs/${id}/approvals`,
    payload: { vendorId: "oakline", action: "send_email", summary: "Email Oakline a quote request." },
  });
  const sent = await app.inject({
    method: "POST",
    url: `/api/approvals/${approved.json().id}`,
    payload: { decision: "approve" },
  });
  assert.equal(sent.json().status, "approved_not_sent");
  assert.equal(sent.json().executed, false);
  assert.match(sent.json().note, /did not email/i);

  const traversal = await app.inject({ method: "GET", url: `/api/runs/${id}/evidence/..%2F../passwd` });
  assert.equal(traversal.statusCode >= 400, true);
  const badName = await app.inject({ method: "GET", url: `/api/runs/${id}/evidence/reedmill/not%20a%20file.png` });
  assert.equal(badName.statusCode, 400);

  const audit = await app.inject({ method: "GET", url: `/api/runs/${id}/audit` });
  assert.equal(audit.statusCode, 200);
  assert.equal(audit.json().schema, "quotecage.audit.v1");
  assert.equal(JSON.stringify(audit.json()).includes("VULTR_INFERENCE_API_KEY"), false);
  await app.close();
});

test("public demo pauses after the per-address limit", async () => {
  const { app } = makeApp({ RATE_LIMIT_RUNS: "1", ALLOW_LIVE_URLS: "true" });
  const payload = { bomText: "HP 26A toner", mode: "live", vendors: [{ id: "quill" }] };
  const first = await app.inject({ method: "POST", url: "/api/runs", payload });
  assert.equal(first.statusCode, 201);
  const second = await app.inject({ method: "POST", url: "/api/runs", payload });
  assert.equal(second.statusCode, 429);
  await app.close();
});

test("optional demo password gates the api", async () => {
  const { app } = makeApp({ DEMO_PASSWORD: "correct horse" });
  const closed = await app.inject({ method: "GET", url: "/api/vendors" });
  assert.equal(closed.statusCode, 401);
  const openHealth = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(openHealth.statusCode, 200);
  const session = await app.inject({ method: "POST", url: "/api/session", payload: { password: "correct horse" } });
  assert.equal(session.statusCode, 200);
  const cookie = String(session.headers["set-cookie"]).split(";")[0];
  const opened = await app.inject({ method: "GET", url: "/api/vendors", headers: { cookie } });
  assert.equal(opened.statusCode, 200);
  await app.close();
});
