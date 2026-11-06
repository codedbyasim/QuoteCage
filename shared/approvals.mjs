import { canExecuteContact, isContactAction } from "./policy.mjs";

export function decideApproval(approval, decision) {
  if (!approval || approval.status !== "pending") {
    throw new Error("This action is not waiting for a decision.");
  }
  if (!isContactAction(approval.actionType)) {
    throw new Error("Unknown action.");
  }
  if (decision !== "approve" && decision !== "deny") {
    throw new Error("Decision must be approve or deny.");
  }
  if (decision === "deny") {
    return {
      ...approval,
      status: "denied",
      executed: false,
      note: "Denied by a person. Nothing was sent.",
    };
  }
  return {
    ...approval,
    status: "approved_not_sent",
    executed: canExecuteContact(),
    note: "Recorded on the audit trail. QuoteCage did not email the vendor, submit a form, or place an order.",
  };
}
