import { timingSafeEqual, createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { decideApproval } from "../../../shared/approvals.mjs";
import { isContactAction } from "../../../shared/policy.mjs";
import { buildAudit, buildEvidenceZip } from "./audit.js";
import { emit, subscribe } from "./bus.js";
import { loadCatalog } from "./catalog.js";
import { loadRealVendors } from "./live.js";
import { rfqDraft } from "./live.js";
import { loadConfig, resolveInferenceMode, type Config } from "./config.js";
import { createRepository, openDatabase, type Repository } from "./db.js";
import { presentRun } from "./present.js";
import { destroyLeftoverSandboxes, type DockerLike } from "./runner.js";
import { createRunService, httpError, writeAllowlist } from "./runs.js";
import { fixtureHosts } from "./catalog.js";

const require = createRequire(import.meta.url);

export type AppDeps = {
  config: Config;
  repo: Repository;
  docker: DockerLike | null;
};

function sessionToken(password: string) {
  return createHmac("sha256", password).update("quotecage-session-v1").digest("hex");
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function safeName(value: string, pattern: RegExp) {
  if (!pattern.test(value)) throw httpError(400, "That file name is not allowed.");
  return value;
}

export function buildApp(deps: AppDeps) {
  const { config, repo } = deps;
  const catalog = loadCatalog();
  const app = Fastify({ logger: true, bodyLimit: 1_000_000 });
  const runs = createRunService({ config, repo, catalog, docker: deps.docker });

  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode || 500;
    if (status >= 500) request.log.error(error);
    const message = error instanceof Error ? error.message : "Something went wrong.";
    reply.code(status).send({ error: status >= 500 ? "Something went wrong." : message });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!config.demoPassword) return;
    const pathname = request.url.split("?")[0];
    if (pathname === "/api/health" || pathname === "/api/session") return;
    const given = readCookie(request.headers.cookie, "qc_session");
    if (!safeEqual(given, sessionToken(config.demoPassword))) {
      return reply.code(401).send({ error: "Sign in required." });
    }
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "quotecage",
    inferenceMode: resolveInferenceMode(config),
    keyPresent: Boolean(config.inferenceKey),
    plannerModel: config.plannerModel,
    visionModel: config.visionModel,
    allowLiveUrls: config.allowLiveUrls,
    sandboxRuntime: config.sandboxRuntime,
    authRequired: Boolean(config.demoPassword),
  }));

  app.post("/api/session", async (request, reply) => {
    if (!config.demoPassword) return { ok: true, authRequired: false };
    const body = request.body as { password?: string };
    if (!safeEqual(String(body?.password || ""), config.demoPassword)) {
      return reply.code(401).send({ error: "Wrong password." });
    }
    const secure = config.cookieSecure ? "; Secure" : "";
    reply.header("set-cookie", `qc_session=${sessionToken(config.demoPassword)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
    return { ok: true };
  });

  app.get("/api/vendors", async () => {
    const real = loadRealVendors();
    return {
      vendors: catalog.vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        tagline: vendor.tagline,
        shippingLabel: vendor.shippingLabel,
        fixture: true,
      })),
      stores: real.stores.map((store) => ({
        id: store.id,
        name: store.name,
        blurb: store.blurb,
        url: store.url,
      })),
      exampleBom: real.exampleBom,
      samples: catalog.samples,
      allowLiveUrls: config.allowLiveUrls,
      rateLimitRuns: config.rateLimitRuns,
    };
  });

  app.post("/api/runs", async (request, reply) => {
    const body = request.body as { bomText?: string; vendorIds?: string[]; vendors?: { id?: string; name?: string; url?: string }[]; liveVendors?: { name?: string; url?: string }[]; mode?: string };
    const forwarded = request.headers["x-forwarded-for"];
    const clientIp = (typeof forwarded === "string" && forwarded ? forwarded.split(",")[0].trim() : request.ip) || "unknown";
    const id = runs.create({
      bomText: String(body?.bomText || ""),
      vendorIds: Array.isArray(body?.vendorIds) ? body.vendorIds.map(String) : [],
      vendors: Array.isArray(body?.vendors) ? body.vendors : [],
      liveVendors: Array.isArray(body?.liveVendors) ? body.liveVendors : [],
      mode: body?.mode,
      clientIp,
    });
    reply.code(201);
    return { id };
  });

  app.get("/api/runs/:id", async (request) => {
    const { id } = request.params as { id: string };
    const run = presentRun(repo, catalog, id);
    if (!run) throw httpError(404, "Run not found.");
    return run;
  });

  app.get("/api/runs/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!repo.getRun(id)) throw httpError(404, "Run not found.");
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    const send = (event: unknown) => {
      reply.raw.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
    };
    for (const event of repo.listEvents(id)) send(event);
    const unsubscribe = subscribe(id, send);
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 15000);
    request.raw.on("close", () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  app.get("/api/runs/:id/audit", async (request, reply) => {
    const { id } = request.params as { id: string };
    const audit = buildAudit(repo, catalog, id);
    if (!audit) throw httpError(404, "Run not found.");
    reply.header("content-disposition", `attachment; filename="quotecage-${id}-audit.json"`);
    return audit;
  });

  app.get("/api/runs/:id/evidence.zip", async (request, reply) => {
    const { id } = request.params as { id: string };
    const zip = buildEvidenceZip(repo, catalog, id);
    if (!zip) throw httpError(404, "Run not found.");
    reply.header("content-type", "application/zip");
    reply.header("content-disposition", `attachment; filename="quotecage-${id}-evidence.zip"`);
    return reply.send(zip);
  });

  app.get("/api/runs/:id/evidence/:vendorId/:filename", async (request, reply) => {
    const params = request.params as { id: string; vendorId: string; filename: string };
    const vendorId = safeName(params.vendorId, /^[a-z0-9-]+$/i);
    const filename = safeName(params.filename, /^[a-z0-9._-]+$/i);
    const row = repo.getEvidence(params.id, vendorId, filename);
    if (!row) throw httpError(404, "Evidence not found.");
    const bytes = readFileSync(row.path);
    const type = filename.endsWith(".png") ? "image/png" : "application/json";
    reply.header("content-type", type);
    reply.header("cache-control", "no-store");
    return reply.send(bytes);
  });

  app.post("/api/runs/:id/approvals", async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = presentRun(repo, catalog, id);
    if (!run) throw httpError(404, "Run not found.");
    const body = request.body as { vendorId?: string; action?: string; summary?: string };
    const vendorId = String(body?.vendorId || "");
    const vendor = run.vendors.find((entry) => entry.vendorId === vendorId);
    if (!vendor) throw httpError(400, "Unknown vendor for this run.");
    const action = String(body?.action || "request_quote");
    if (!isContactAction(action)) throw httpError(400, "That action is not recognized.");
    const existing = run.approvals.find((approval) => approval.vendorId === vendorId && approval.actionType === action && approval.status === "pending");
    if (existing) return existing;
    const approval = {
      id: crypto.randomUUID(),
      runId: id,
      vendorId,
      actionType: action,
      summary: rfqDraft(vendor.name, run.plan?.items || []).slice(0, 2000),
      status: "pending" as const,
      source: "buyer",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      note: null,
      executed: false as const,
    };
    repo.insertApproval(approval);
    emit(repo, id, "approval_required", approval.summary, { vendorId, action });
    reply.code(201);
    return approval;
  });

  app.post("/api/approvals/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { decision?: string };
    const current = repo.getApproval(id);
    if (!current) throw httpError(404, "Approval not found.");
    if (current.status !== "pending") throw httpError(400, "This action is not waiting for a decision.");
    const decision = body?.decision === "approve" ? "approve" : body?.decision === "deny" ? "deny" : null;
    if (!decision) throw httpError(400, "Decision must be approve or deny.");
    const next = decideApproval(current, decision);
    next.decidedAt = new Date().toISOString();
    repo.updateApproval(next);
    emit(repo, current.runId, decision === "deny" ? "approval_denied" : "approval_recorded", next.note || "Decision recorded.", {
      approvalId: id,
      executed: false,
      status: next.status,
    });
    return { ...next, executed: false };
  });

  return app;
}

export async function start() {
  const config = loadConfig();
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.workDir, { recursive: true });
  mkdirSync(config.allowDir, { recursive: true });
  const catalog = loadCatalog();
  writeAllowlist(config.allowDir, fixtureHosts(catalog));
  const repo = createRepository(openDatabase(path.join(config.dataDir, "quotecage.sqlite")));
  repo.failStale("The control plane restarted before this run finished.");
  const docker = connectDocker(config.dockerSocket);
  if (docker) {
    const removed = await destroyLeftoverSandboxes(docker).catch(() => 0);
    if (removed) console.log(`removed ${removed} leftover sandbox containers`);
  }
  const app = buildApp({ config, repo, docker });
  await app.listen({ port: config.port, host: config.host });
}

function connectDocker(socketPath: string): DockerLike | null {
  if (!existsSync(socketPath)) return null;
  const Docker = require("dockerode") as new (opts: { socketPath: string }) => DockerLike;
  return new Docker({ socketPath });
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && entry === fileURLToPath(import.meta.url)) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export type { FastifyReply, FastifyRequest };
