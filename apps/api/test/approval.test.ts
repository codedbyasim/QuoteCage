import assert from "node:assert/strict";
import test from "node:test";
import { decideApproval } from "../../../shared/approvals.mjs";

test("deny and approve both leave the action unsent", () => {
  const pending = { id: "1", status: "pending", actionType: "send_email", summary: "Email the buyer list" };
  const denied = decideApproval(pending, "deny");
  assert.equal(denied.status, "denied");
  assert.equal(denied.executed, false);
  const approved = decideApproval(pending, "approve");
  assert.equal(approved.status, "approved_not_sent");
  assert.equal(approved.executed, false);
  assert.match(approved.note, /did not email/i);
  assert.throws(() => decideApproval(approved, "deny"));
});
