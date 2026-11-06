import type { Approval } from "../types";

export function ApprovalGate({
  approvals,
  vendorName,
  onDecide,
  busyId,
}: {
  approvals: Approval[];
  vendorName: (id: string) => string;
  onDecide: (id: string, decision: "approve" | "deny") => void;
  busyId: string | null;
}) {
  if (approvals.length === 0) return null;
  const pending = approvals.filter((approval) => approval.status === "pending");
  return (
    <section className="gate" aria-live="assertive">
      <div className="section-head">
        <p className="kicker">Person required</p>
        <h2>{pending.length > 0 ? "These actions are waiting." : "Decisions on this run"}</h2>
        <p>Approve records the choice on the audit trail and does not email, submit, or pay. Deny leaves it unsent.</p>
      </div>
      <ul className="approvals">
        {approvals.map((approval) => (
          <li key={approval.id}>
            <div>
              <p className="approval-type">{label(approval.actionType)} · {vendorName(approval.vendorId)} · {approval.source === "prompt_injection" ? "From the page" : "From you"}</p>
              <p>{approval.summary}</p>
              {approval.note ? <p className="muted">{approval.note}</p> : null}
            </div>
            {approval.status === "pending" ? (
              <div className="decision">
                <button type="button" className="button danger" disabled={busyId === approval.id} onClick={() => onDecide(approval.id, "deny")}>
                  Deny
                </button>
                <button type="button" className="button small" disabled={busyId === approval.id} onClick={() => onDecide(approval.id, "approve")}>
                  Approve and record
                </button>
              </div>
            ) : (
              <span className={`badge ${approval.status === "denied" ? "oxide" : "pine"}`}>
                {approval.status === "denied" ? "Denied" : "Recorded, not sent"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function label(action: string) {
  if (action === "send_email") return "Email";
  if (action === "checkout") return "Checkout";
  if (action === "download") return "Download";
  if (action === "request_quote") return "Quote request";
  return action;
}
