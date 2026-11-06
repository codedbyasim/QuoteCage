import type { RunEvent } from "../types";

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
        <p className="kicker">Security and lifecycle</p>
        <h2>What the cage did</h2>
      </div>
      {events.length === 0 ? <p className="muted">Events show up here as the run moves.</p> : (
        <ol>
          {events.map((event) => (
            <li key={event.id} className={LOUD.has(event.kind) ? "loud" : ""}>
              <time dateTime={event.ts}>{event.ts.slice(11, 19)}</time>
              <div>
                <p className="kind">{event.kind.replaceAll("_", " ")}</p>
                <p>{event.message}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
