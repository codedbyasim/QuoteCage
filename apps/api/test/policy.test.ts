import assert from "node:assert/strict";
import test from "node:test";
import { assertEnvEntriesSafe, canExecuteContact, decideEgress, isContactAction } from "../../../shared/policy.mjs";

const fixtures = ["reedmill.fixtures", "brightcartridge.fixtures", "oakline.fixtures", "quickquote.fixtures"];

test("fixture hosts are allowed and everything else is denied", () => {
  assert.equal(decideEgress("http://reedmill.fixtures/cart", fixtures).allow, true);
  assert.equal(decideEgress("http://exfil.evil/collect", fixtures).reason, "not_allowlisted");
  assert.equal(decideEgress("http://169.254.169.254/latest/meta-data/", fixtures).reason, "blocked_host");
  assert.equal(decideEgress("http://1.1.1.1/", fixtures).reason, "ip_literal");
  assert.equal(decideEgress("http://metadata.google.internal/", fixtures).reason, "blocked_host");
  assert.equal(decideEgress("http://localhost/api", fixtures).reason, "blocked_host");
  assert.equal(decideEgress("file:///etc/passwd", fixtures).reason, "scheme");
  assert.equal(decideEgress("http://api.vultrinference.com/v1/chat/completions", fixtures).allow, false);
  assert.equal(decideEgress("https://www.quill.com/search", [".quill.com"]).allow, true);
  assert.equal(decideEgress("https://notquill.com/", [".quill.com"]).allow, false);
  assert.equal(decideEgress("https://exfil.evil/collect", [".quill.com", ".gstatic.com"]).allow, false);
});

test("secret-like environment entries are rejected", () => {
  assert.deepEqual(assertEnvEntriesSafe(["HOME=/tmp/home", "PATH=/usr/bin"]), []);
  assert.equal(assertEnvEntriesSafe(["VULTR_INFERENCE_API_KEY=abc"]).length > 0, true);
  assert.equal(assertEnvEntriesSafe(["LANG=sk-live-secret"]).length > 0, true);
});

test("contact actions cannot be executed by the product", () => {
  assert.equal(isContactAction("send_email"), true);
  assert.equal(isContactAction("checkout"), true);
  assert.equal(isContactAction("request_quote"), true);
  assert.equal(isContactAction("browse"), false);
  assert.equal(canExecuteContact(), false);
});
