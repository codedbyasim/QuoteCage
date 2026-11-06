const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
  "metadata.google.internal",
]);

const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i;

export const CONTACT_ACTIONS = new Set([
  "send_email",
  "request_quote",
  "submit_form",
  "checkout",
  "add_to_cart_checkout",
  "download",
  "exfiltrate",
]);

export function decideEgress(rawUrl, allowHosts) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2000) {
    return { allow: false, reason: "bad_url", host: null };
  }
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:") || rawUrl.startsWith("about:")) {
    return { allow: true, reason: "local", host: null };
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allow: false, reason: "bad_url", host: null };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allow: false, reason: "scheme", host: url.hostname };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host)) {
    return { allow: false, reason: "blocked_host", host };
  }
  if (host.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { allow: false, reason: "ip_literal", host };
  }
  const allow = new Set((allowHosts || []).map((h) => String(h).toLowerCase()));
  if (!allow.has(host)) {
    return { allow: false, reason: "not_allowlisted", host };
  }
  return { allow: true, reason: "allowlisted", host };
}

export function assertEnvEntriesSafe(entries) {
  const violations = [];
  for (const entry of entries) {
    const eq = entry.indexOf("=");
    const name = eq === -1 ? entry : entry.slice(0, eq);
    const value = eq === -1 ? "" : entry.slice(eq + 1);
    if (SECRET_NAME.test(name)) violations.push(`name:${name}`);
    if (/vultr|sk-|api[_-]?key|BEGIN [A-Z ]*PRIVATE KEY/i.test(value)) {
      violations.push(`value:${name}`);
    }
  }
  return violations;
}

export function isContactAction(actionType) {
  return CONTACT_ACTIONS.has(actionType);
}

export function canExecuteContact() {
  return false;
}
