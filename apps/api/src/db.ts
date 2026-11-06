import { DatabaseSync } from "node:sqlite";
import type { Approval, ApprovalStatus, Plan, Recommendation, RunEvent } from "./types.js";

export type RunRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  bomText: string;
  vendorIds: string[];
  plan: Plan | null;
  inference: Record<string, unknown> | null;
  recommendation: Recommendation | null;
  containment: Record<string, unknown> | null;
  error: string | null;
};

export type VendorRunRow = {
  id: string;
  runId: string;
  vendorId: string;
  name: string;
  status: string;
  containerId: string | null;
  result: Record<string, unknown> | null;
  vision: Record<string, unknown> | null;
  sandbox: Record<string, unknown> | null;
  destroyed: boolean;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type RunSql = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  bom_text: string;
  vendor_ids: string;
  plan_json: string | null;
  inference_json: string | null;
  recommendation_json: string | null;
  containment_json: string | null;
  error: string | null;
};

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  return JSON.parse(value) as T;
}

export function openDatabase(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      bom_text TEXT NOT NULL,
      vendor_ids TEXT NOT NULL,
      plan_json TEXT,
      inference_json TEXT,
      recommendation_json TEXT,
      containment_json TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS vendor_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      container_id TEXT,
      result_json TEXT,
      vision_json TEXT,
      sandbox_json TEXT,
      destroyed INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      started_at TEXT,
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      data_json TEXT
    );
    CREATE INDEX IF NOT EXISTS events_run ON events(run_id);
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      path TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      note TEXT
    );
  `);
  return db;
}

export function createRepository(db: DatabaseSync) {
  const insertRunStmt = db.prepare(`INSERT INTO runs (
    id, created_at, updated_at, status, bom_text, vendor_ids, plan_json, inference_json, recommendation_json, containment_json, error
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const updateRunStmt = db.prepare(`UPDATE runs SET updated_at = ?, status = ?, plan_json = ?, inference_json = ?, recommendation_json = ?, containment_json = ?, error = ? WHERE id = ?`);
  const getRunStmt = db.prepare(`SELECT * FROM runs WHERE id = ?`);
  const insertVendorStmt = db.prepare(`INSERT INTO vendor_runs (
    id, run_id, vendor_id, name, status, container_id, result_json, vision_json, sandbox_json, destroyed, error, started_at, finished_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const updateVendorStmt = db.prepare(`UPDATE vendor_runs SET status = ?, container_id = ?, result_json = ?, vision_json = ?, sandbox_json = ?, destroyed = ?, error = ?, started_at = ?, finished_at = ? WHERE id = ?`);
  const listVendorsStmt = db.prepare(`SELECT * FROM vendor_runs WHERE run_id = ? ORDER BY rowid`);
  const insertEventStmt = db.prepare(`INSERT INTO events (run_id, ts, kind, message, data_json) VALUES (?, ?, ?, ?, ?)`);
  const listEventsStmt = db.prepare(`SELECT * FROM events WHERE run_id = ? ORDER BY id`);
  const insertEvidenceStmt = db.prepare(`INSERT INTO evidence (id, run_id, vendor_id, filename, sha256, bytes, path) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const listEvidenceStmt = db.prepare(`SELECT * FROM evidence WHERE run_id = ? ORDER BY rowid`);
  const getEvidenceStmt = db.prepare(`SELECT * FROM evidence WHERE run_id = ? AND vendor_id = ? AND filename = ?`);
  const insertApprovalStmt = db.prepare(`INSERT INTO approvals (
    id, run_id, vendor_id, action_type, summary, status, source, created_at, decided_at, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const listApprovalsStmt = db.prepare(`SELECT * FROM approvals WHERE run_id = ? ORDER BY created_at`);
  const getApprovalStmt = db.prepare(`SELECT * FROM approvals WHERE id = ?`);
  const updateApprovalStmt = db.prepare(`UPDATE approvals SET status = ?, decided_at = ?, note = ? WHERE id = ?`);
  const staleStmt = db.prepare(`UPDATE runs SET status = 'failed', error = ?, updated_at = ? WHERE status IN ('queued', 'planning', 'running')`);

  function mapRun(row: RunSql): RunRow {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      bomText: row.bom_text,
      vendorIds: JSON.parse(row.vendor_ids) as string[],
      plan: parseJson(row.plan_json),
      inference: parseJson(row.inference_json),
      recommendation: parseJson(row.recommendation_json),
      containment: parseJson(row.containment_json),
      error: row.error,
    };
  }

  function mapVendor(row: Record<string, unknown>): VendorRunRow {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      vendorId: String(row.vendor_id),
      name: String(row.name),
      status: String(row.status),
      containerId: (row.container_id as string | null) ?? null,
      result: parseJson(row.result_json as string | null),
      vision: parseJson(row.vision_json as string | null),
      sandbox: parseJson(row.sandbox_json as string | null),
      destroyed: Number(row.destroyed) === 1,
      error: (row.error as string | null) ?? null,
      startedAt: (row.started_at as string | null) ?? null,
      finishedAt: (row.finished_at as string | null) ?? null,
    };
  }

  function mapApproval(row: Record<string, unknown>): Approval {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      vendorId: String(row.vendor_id),
      actionType: String(row.action_type),
      summary: String(row.summary),
      status: String(row.status) as ApprovalStatus,
      source: String(row.source),
      createdAt: String(row.created_at),
      decidedAt: (row.decided_at as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      executed: false,
    };
  }

  return {
    insertRun(run: RunRow) {
      const now = run.createdAt;
      insertRunStmt.run(
        run.id,
        now,
        run.updatedAt,
        run.status,
        run.bomText,
        JSON.stringify(run.vendorIds),
        run.plan ? JSON.stringify(run.plan) : null,
        run.inference ? JSON.stringify(run.inference) : null,
        run.recommendation ? JSON.stringify(run.recommendation) : null,
        run.containment ? JSON.stringify(run.containment) : null,
        run.error,
      );
    },
    updateRun(run: RunRow) {
      updateRunStmt.run(
        new Date().toISOString(),
        run.status,
        run.plan ? JSON.stringify(run.plan) : null,
        run.inference ? JSON.stringify(run.inference) : null,
        run.recommendation ? JSON.stringify(run.recommendation) : null,
        run.containment ? JSON.stringify(run.containment) : null,
        run.error,
        run.id,
      );
    },
    getRun(id: string) {
      const row = getRunStmt.get(id) as RunSql | undefined;
      return row ? mapRun(row) : null;
    },
    insertVendor(row: VendorRunRow) {
      insertVendorStmt.run(
        row.id,
        row.runId,
        row.vendorId,
        row.name,
        row.status,
        row.containerId,
        row.result ? JSON.stringify(row.result) : null,
        row.vision ? JSON.stringify(row.vision) : null,
        row.sandbox ? JSON.stringify(row.sandbox) : null,
        row.destroyed ? 1 : 0,
        row.error,
        row.startedAt,
        row.finishedAt,
      );
    },
    updateVendor(row: VendorRunRow) {
      updateVendorStmt.run(
        row.status,
        row.containerId,
        row.result ? JSON.stringify(row.result) : null,
        row.vision ? JSON.stringify(row.vision) : null,
        row.sandbox ? JSON.stringify(row.sandbox) : null,
        row.destroyed ? 1 : 0,
        row.error,
        row.startedAt,
        row.finishedAt,
        row.id,
      );
    },
    listVendors(runId: string) {
      return (listVendorsStmt.all(runId) as Record<string, unknown>[]).map(mapVendor);
    },
    addEvent(runId: string, kind: string, message: string, data?: unknown): RunEvent {
      const ts = new Date().toISOString();
      const info = insertEventStmt.run(runId, ts, kind, message, data === undefined ? null : JSON.stringify(data));
      return { id: Number(info.lastInsertRowid), runId, ts, kind, message, data: data ?? null };
    },
    listEvents(runId: string): RunEvent[] {
      return (listEventsStmt.all(runId) as Record<string, unknown>[]).map((row) => ({
        id: Number(row.id),
        runId: String(row.run_id),
        ts: String(row.ts),
        kind: String(row.kind),
        message: String(row.message),
        data: parseJson(row.data_json as string | null),
      }));
    },
    addEvidence(row: { id: string; runId: string; vendorId: string; filename: string; sha256: string; bytes: number; path: string }) {
      insertEvidenceStmt.run(row.id, row.runId, row.vendorId, row.filename, row.sha256, row.bytes, row.path);
    },
    listEvidence(runId: string) {
      return listEvidenceStmt.all(runId) as { id: string; run_id: string; vendor_id: string; filename: string; sha256: string; bytes: number; path: string }[];
    },
    getEvidence(runId: string, vendorId: string, filename: string) {
      return getEvidenceStmt.get(runId, vendorId, filename) as { path: string; filename: string; sha256: string; bytes: number } | undefined;
    },
    insertApproval(row: Approval) {
      insertApprovalStmt.run(row.id, row.runId, row.vendorId, row.actionType, row.summary, row.status, row.source, row.createdAt, row.decidedAt, row.note);
    },
    listApprovals(runId: string) {
      return (listApprovalsStmt.all(runId) as Record<string, unknown>[]).map(mapApproval);
    },
    getApproval(id: string) {
      const row = getApprovalStmt.get(id) as Record<string, unknown> | undefined;
      return row ? mapApproval(row) : null;
    },
    updateApproval(row: Approval) {
      updateApprovalStmt.run(row.status, row.decidedAt, row.note, row.id);
    },
    failStale(message: string) {
      staleStmt.run(message, new Date().toISOString());
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
