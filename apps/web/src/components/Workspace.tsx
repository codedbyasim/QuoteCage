import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { catalog } from "../preview";
import { formatUsd } from "../preview";
import type { Approval, RunView, Sample, VendorOption } from "../types";
import { ApprovalGate } from "./ApprovalGate";
import { ScreenshotReel } from "./ScreenshotReel";
import { Timeline } from "./Timeline";
import { VendorCard } from "./VendorCard";

export function Workspace() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState<Sample[]>(catalog.samples);
  const [vendors, setVendors] = useState<VendorOption[]>(catalog.vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    tagline: vendor.tagline,
    shippingLabel: vendor.shippingLabel,
    fixture: true,
  })));
  const [allowLive, setAllowLive] = useState(false);
  const [bom, setBom] = useState(catalog.samples[0]?.bom || "");
  const [selected, setSelected] = useState<string[]>(catalog.vendors.map((vendor) => vendor.id));
  const [liveName, setLiveName] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [auth, setAuth] = useState<"loading" | "ok" | "needed">("loading");
  const [password, setPassword] = useState("");
  const { run, error } = useRun(runId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    document.title = runId ? "Comparison · QuoteCage" : "New comparison · QuoteCage";
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((response) => response.json())
      .then(async (health: { authRequired?: boolean }) => {
        if (cancelled) return;
        if (!health.authRequired) {
          setAuth("ok");
          return;
        }
        const vendorsResponse = await fetch("/api/vendors");
        if (!cancelled) setAuth(vendorsResponse.ok ? "ok" : "needed");
      })
      .catch(() => {
        if (!cancelled) setAuth("ok");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (auth !== "ok") return;
    let cancelled = false;
    api<{ vendors: VendorOption[]; samples: Sample[]; allowLiveUrls: boolean }>("/api/vendors")
      .then((body) => {
        if (cancelled) return;
        setVendors(body.vendors);
        setSamples(body.samples);
        setAllowLive(body.allowLiveUrls);
      })
      .catch(() => {
        // The bundled catalog still lets the form render.
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await api("/api/session", { method: "POST", body: JSON.stringify({ password }) });
      setAuth("ok");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not sign in.");
    }
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const liveVendors = liveUrl.trim() ? [{ name: liveName.trim() || liveUrl.trim(), url: liveUrl.trim() }] : [];
      const created = await api<{ id: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({ bomText: bom, vendorIds: selected, liveVendors }),
      });
      navigate(`/app/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestQuote(vendorId: string) {
    if (!run) return;
    setActionError(null);
    try {
      await api(`/api/runs/${run.id}/approvals`, {
        method: "POST",
        body: JSON.stringify({ vendorId, action: "request_quote" }),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not queue that request.");
    }
  }

  async function decide(id: string, decision: "approve" | "deny") {
    setBusyId(id);
    setActionError(null);
    try {
      await api(`/api/approvals/${id}`, { method: "POST", body: JSON.stringify({ decision }) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record the decision.");
    } finally {
      setBusyId(null);
    }
  }

  const vendorName = (id: string) => run?.vendors.find((vendor) => vendor.vendorId === id)?.name || vendors.find((vendor) => vendor.id === id)?.name || id;
  const statusText = liveStatus(run);

  return (
    <main id="content" className="page workspace">
      {auth === "needed" ? (
        <form className="composer" onSubmit={signIn}>
          <h1>This demo is locked.</h1>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          <button className="button primary" type="submit">Unlock</button>
        </form>
      ) : (
        <form className="composer" onSubmit={start}>
          <div className="section-head">
            <p className="kicker">Comparison</p>
            <h1>What are you buying this week?</h1>
          </div>
          <div className="samples">
            {samples.map((sample) => (
              <button key={sample.id} type="button" className={bom === sample.bom ? "chip on" : "chip"} onClick={() => setBom(sample.bom)}>
                {sample.title}
              </button>
            ))}
          </div>
          <label htmlFor="bom">Shopping list</label>
          <textarea id="bom" value={bom} onChange={(event) => setBom(event.target.value)} rows={4} required />
          <fieldset>
            <legend>Fixture vendors</legend>
            <div className="vendor-picks">
              {vendors.map((vendor) => (
                <label key={vendor.id} className="pick">
                  <input
                    type="checkbox"
                    checked={selected.includes(vendor.id)}
                    onChange={() => setSelected((current) => current.includes(vendor.id) ? current.filter((id) => id !== vendor.id) : [...current, vendor.id])}
                  />
                  <span>
                    <strong>{vendor.name}</strong>
                    <small>{vendor.shippingLabel}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <details className="live-url">
            <summary>Optional live URL</summary>
            <p className="muted">{allowLive ? "The server will add this host to the allowlist for one sandbox." : "The server currently refuses live URLs. Set ALLOW_LIVE_URLS=true to enable one extra host."}</p>
            <label htmlFor="live-name">Name</label>
            <input id="live-name" value={liveName} onChange={(event) => setLiveName(event.target.value)} />
            <label htmlFor="live-url">URL</label>
            <input id="live-url" type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://" />
          </details>
          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          <button className="button primary" type="submit" disabled={submitting || selected.length === 0}>
            {submitting ? "Starting" : "Compare these vendors"}
          </button>
        </form>
      )}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {run ? (
        <>
          <p className="live" aria-live="polite">{statusText}</p>
          <ol className="rail">
            <li className={run.plan ? "done" : "active"}>Plan</li>
            {run.vendors.map((vendor) => (
              <li key={vendor.vendorId} className={railClass(vendor.status)}>{vendor.name}</li>
            ))}
            <li className={run.status === "complete" ? "done" : ""}>Decide</li>
          </ol>
          <p className="inference">
            {run.inference?.mode === "live"
              ? `Planner and vision: ${run.inference.plannerModel || run.inference.visionModel}`
              : "Planner: deterministic mock. No inference key was used."}
            {run.inference?.fallback ? ` Model fallback: ${run.inference.fallback}` : ""}
          </p>
          {run.plan ? (
            <ul className="plan-pills">
              {run.plan.items.map((item) => (
                <li key={`${item.sku}-${item.name}`}>{item.qty} × {item.name}{item.sku ? "" : " · unrecognized"}</li>
              ))}
            </ul>
          ) : null}
          {run.recommendation ? (
            <section className="recommend">
              <p className="kicker">Recommendation</p>
              <h2>{run.recommendation.bestValueVendorId ? vendorName(run.recommendation.bestValueVendorId) : "No clean full quote"}</h2>
              <p className="recommend-price">{run.recommendation.bestValueCents != null ? formatUsd(run.recommendation.bestValueCents) : "—"}</p>
              <p>{run.recommendation.summary}</p>
            </section>
          ) : null}
          {run.error ? <p className="form-error" role="alert">{run.error}</p> : null}
          {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
          <ApprovalGate approvals={run.approvals} vendorName={vendorName} onDecide={decide} busyId={busyId} />
          <div className="vendor-grid">
            {run.vendors.map((vendor) => (
              <VendorCard
                key={vendor.vendorId}
                vendor={vendor}
                recommended={run.recommendation?.bestValueVendorId === vendor.vendorId}
                cheapest={Boolean(run.recommendation?.cheapestIsUntrusted && run.recommendation.cheapestVendorId === vendor.vendorId)}
                onRequestQuote={requestQuote}
              />
            ))}
          </div>
          <ScreenshotReel vendors={run.vendors} />
          <div className="split">
            <Timeline events={run.events} />
            <Evidence run={run} />
          </div>
        </>
      ) : null}
    </main>
  );
}

function Evidence({ run }: { run: RunView }) {
  return (
    <section className="evidence">
      <div className="section-head">
        <p className="kicker">Export</p>
        <h2>Hashes for this run</h2>
      </div>
      <p className="muted">Secrets in sandbox: {run.containment?.secretsInSandbox ?? 0}. Network: {run.containment?.network || "internal allowlist"}.</p>
      {run.containment?.runtimeNote ? <p>{run.containment.runtimeNote}</p> : null}
      <ul className="hash-list">
        {run.evidence.map((item) => (
          <li key={`${item.vendorId}-${item.filename}`}>
            <span>{item.filename}</span>
            <code>{item.sha256}</code>
          </li>
        ))}
      </ul>
      <div className="hero-actions">
        <a className="button small" href={`/api/runs/${run.id}/audit`}>Download audit JSON</a>
        <a className="button small" href={`/api/runs/${run.id}/evidence.zip`}>Download evidence ZIP</a>
      </div>
    </section>
  );
}

function railClass(status: string) {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "starting" || status === "verifying" || status === "running") return "active";
  return "";
}

function liveStatus(run: RunView | null) {
  if (!run) return "";
  if (run.status === "complete") return "Comparison ready.";
  if (run.status === "failed") return run.error || "The run failed.";
  if (run.status === "planning") return "Normalizing the shopping list.";
  const active = run.vendors.find((vendor) => vendor.status === "starting" || vendor.status === "verifying");
  if (active) return `Visiting ${active.name}.`;
  return "Working through the vendors.";
}

function useRun(runId: string | undefined) {
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!runId) {
      setRun(null);
      setError(null);
      return;
    }
    let stopped = false;
    const load = async () => {
      try {
        const next = await api<RunView>(`/api/runs/${runId}`);
        if (!stopped) {
          setRun(next);
          setError(null);
        }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Could not load the run.");
      }
    };
    void load();
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = () => {
      void load();
    };
    const poll = window.setInterval(() => {
      void load();
    }, 2500);
    return () => {
      stopped = true;
      source.close();
      window.clearInterval(poll);
    };
  }, [runId]);
  return { run, error };
}

export type { Approval };
