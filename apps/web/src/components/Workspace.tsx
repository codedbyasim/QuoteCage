import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"live" | "safety">(params.get("mode") === "safety" ? "safety" : "live");
  const [stores, setStores] = useState<{ id: string; name: string; blurb: string; url: string }[]>([]);
  const [exampleBom, setExampleBom] = useState("HP 26A toner");
  const [allowLive, setAllowLive] = useState(true);
  const [bom, setBom] = useState("HP 26A toner");
  const [selectedStores, setSelectedStores] = useState<string[]>(["quill", "cdw"]);
  const [selected, setSelected] = useState<string[]>(catalog.vendors.map((vendor) => vendor.id));
  const [customUrl, setCustomUrl] = useState("");
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
    api<{ vendors: VendorOption[]; samples: Sample[]; allowLiveUrls: boolean; stores?: { id: string; name: string; blurb: string; url: string }[]; exampleBom?: string }>("/api/vendors")
      .then((body) => {
        if (cancelled) return;
        setVendors(body.vendors);
        setSamples(body.samples);
        setAllowLive(body.allowLiveUrls);
        if (body.stores && body.stores.length > 0) setStores(body.stores);
        if (body.exampleBom) setExampleBom(body.exampleBom);
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
      const vendors = mode === "live"
        ? [
          ...selectedStores.map((id) => ({ id })),
          ...(customUrl.trim() ? [{ name: "Custom link", url: customUrl.trim() }] : []),
        ]
        : [];
      const created = await api<{ id: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify(mode === "live"
          ? { bomText: bom, mode: "live", vendors }
          : { bomText: bom, mode: "safety", vendorIds: selected }),
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
            <p className="kicker">{mode === "live" ? "Step 1 of 3" : "Safety demo"}</p>
            <h1>{mode === "live" ? "What are you pricing?" : "Watch a hostile page get blocked."}</h1>
            <p className="helper">{mode === "live"
              ? "Paste a list, pick public stores, then watch each one open in its own browser. A blocked site stays blank. A price without a vision check is marked unverified."
              : "These shops are fictional. One of them tries to make the browser email customer data. Use this to see the cage, not to compare real prices."}</p>
          </div>
          <div className="samples" role="tablist" aria-label="Comparison mode">
            <button type="button" className={mode === "live" ? "chip on" : "chip"} onClick={() => setMode("live")}>Real stores</button>
            <button type="button" className={mode === "safety" ? "chip on" : "chip"} onClick={() => setMode("safety")}>Safety demo</button>
          </div>
          {mode === "live" ? (
            <button type="button" className="chip" onClick={() => { setBom(exampleBom); setSelectedStores(["quill", "cdw"]); }}>
              Try “{exampleBom}” on Quill and CDW
            </button>
          ) : (
            <div className="samples">
              {samples.map((sample) => (
                <button key={sample.id} type="button" className={bom === sample.bom ? "chip on" : "chip"} onClick={() => setBom(sample.bom)}>
                  {sample.title}
                </button>
              ))}
            </div>
          )}
          <label htmlFor="bom">Shopping list</label>
          <textarea id="bom" value={bom} onChange={(event) => setBom(event.target.value)} rows={3} required />
          <p className="helper">Step 2 — pick up to three real stores, or the fixture shops in the safety demo.</p>
          {mode === "live" ? (
            <fieldset>
              <legend>Real stores</legend>
              <div className="vendor-picks">
                {(stores.length > 0 ? stores : [
                  { id: "quill", name: "Quill", blurb: "Office supplies", url: "https://www.quill.com/" },
                  { id: "cdw", name: "CDW", blurb: "Business technology", url: "https://www.cdw.com/" },
                  { id: "ikea", name: "IKEA", blurb: "Furniture", url: "https://www.ikea.com/us/en/" },
                  { id: "jampaper", name: "JAM Paper", blurb: "Paper and cardstock", url: "https://www.jampaper.com/" },
                ]).map((store) => (
                  <label key={store.id} className="pick">
                    <input
                      type="checkbox"
                      checked={selectedStores.includes(store.id)}
                      onChange={() => setSelectedStores((current) => current.includes(store.id) ? current.filter((id) => id !== store.id) : [...current, store.id].slice(0, 3))}
                    />
                    <span>
                      <strong>{store.name}</strong>
                      <small>{store.blurb}</small>
                    </span>
                  </label>
                ))}
              </div>
              <label htmlFor="custom-url">Or paste one https link</label>
              <input id="custom-url" type="url" inputMode="url" placeholder="https://www.quill.com/search?keywords=HP+26A" value={customUrl} onChange={(event) => setCustomUrl(event.target.value)} />
              <p className="helper">{allowLive ? "Only that site, its subdomains, and a few font or storefront hosts are allowed out." : "This server is refusing custom links. Listed stores still run."}</p>
            </fieldset>
          ) : (
            <fieldset>
              <legend>Fictional fixture shops</legend>
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
          )}
          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          <button className="button primary" type="submit" disabled={submitting || (mode === "live" ? selectedStores.length + (customUrl.trim() ? 1 : 0) === 0 : selected.length === 0)}>
            {submitting ? "Starting" : mode === "live" ? "Compare these stores" : "Run the safety demo"}
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
