import type { RunEvent } from "../types";

const PLAIN: Record<string, string> = {
  run_created: "The comparison was queued.",
  plan_ready: "The shopping list was turned into searches.",
  runtime_selected: "The sealed browser runtime is ready.",
  runtime_fallback: "gVisor could not reach the proxy, so this run continued with the standard runtime.",
  sandbox_created: "A fresh browser was created for one store.",
  sandbox_started: "That browser started.",
  sandbox_destroyed: "That browser was destroyed.",
  egress_denied: "A call to a host that was not on this store's list was blocked.",
  network_probe: "The browser had no direct route to the public internet.",
  injection_detected: "The page tried to give the browser new instructions. They were ignored.",
  vision_checked: "The price check finished. Unverified prices are not an award.",
  approval_required: "A person has to decide before any vendor contact.",
  approval_denied: "Denied. Nothing was sent.",
  approval_recorded: "Recorded. Nothing was sent.",
  vendor_finished: "That store's visit finished.",
};

const LOUD = new Set([
  "egress_denied",
  "injection_detected",
  "approval_required",
  "approval_denied",
  "approval_recorded",
  "sandbox_destroyed",
  "sandbox_created",
  "containment_breach",
  "secret_leak",
  "network_probe",
  "runtime_fallback",
]);

export function Timeline({ events }: { events: RunEvent[] }) {
  return (
    <section className="timeline">
      <div className="section-head">
        <p className="kicker">Security timeline</p>
        <h2>What the sealed browser did</h2>
        <p>Each line is one thing that happened. A blocked call means the page tried to reach a host that was not on that store's list. The browser is destroyed when the visit ends. Nothing here places an order.</p>
      </div>
      {events.length === 0 ? <p className="muted">Events show up here as the run moves.</p> : (
        <ol>
          {events.map((event) => (
            <li key={event.id} className={LOUD.has(event.kind) ? "loud" : ""}>
              <time dateTime={event.ts}>{event.ts.slice(11, 19)}</time>
              <div>
                <p className="kind">{event.kind.replaceAll("_", " ")}</p>
                <p>{PLAIN[event.kind] || event.message}</p>
                {PLAIN[event.kind] ? <p className="muted">{event.message}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
