import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { decideEgress } from "./policy.mjs";

const taskPath = process.argv[2] || "/task/task.json";
const outDir = process.argv[3] || "/out";
const task = JSON.parse(readFileSync(taskPath, "utf8"));

mkdirSync(outDir, { recursive: true });
mkdirSync("/tmp/home", { recursive: true });
mkdirSync("/tmp/cache", { recursive: true });
mkdirSync("/tmp/config", { recursive: true });

const allowHosts = task.allowHosts || [];
const egress = [];
const injectionExcerpts = [];
const screenshots = [];

function log(message) {
  console.log(`quotecage: ${message}`);
}

function recordEgress(url, reason) {
  if (egress.some((entry) => entry.url === url && entry.reason === reason)) return;
  egress.push({ url, reason, at: new Date().toISOString() });
  log(`egress deny reason=${reason} url=${url}`);
}

function probeTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs });
    const finish = (reachable, error) => {
      socket.destroy();
      resolve({ host, port, reachable, error });
    };
    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (error) => finish(false, error.code || error.message));
  });
}

async function shoot(page, file, label) {
  const path = `${outDir}/${file}`;
  await page.screenshot({ path, type: "png" });
  screenshots.push({ file, label });
}

async function collectInjection(page) {
  const bits = await page.locator("[data-qc-injection]").allInnerTexts().catch(() => []);
  for (const bit of bits) {
    const text = bit.replace(/\s+/g, " ").trim().slice(0, 700);
    if (text && !injectionExcerpts.includes(text)) injectionExcerpts.push(text);
  }
}

const result = {
  vendorId: task.vendorId,
  baseUrl: task.baseUrl,
  lines: [],
  subtotalCents: null,
  shippingCents: null,
  shippingLabel: null,
  fees: [],
  feeCents: null,
  totalCents: null,
  complete: false,
  tainted: false,
  currency: "USD",
  screenshots,
  visibleText: "",
  injectionExcerpts,
  egress,
  proposedActions: [],
  networkProbe: null,
  containment: {
    secretsInEnv: 0,
    envNames: Object.keys(process.env).sort(),
  },
  refusals: [],
  error: null,
};

const secretNames = result.containment.envNames.filter((name) => /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i.test(name));
result.containment.secretsInEnv = secretNames.length;
result.containment.secretLikeNames = secretNames;

let browser;
try {
  const fixtureHost = new URL(task.baseUrl).hostname;
  const [direct, fixture] = await Promise.all([
    probeTcp("1.1.1.1", 443, 3000),
    probeTcp(fixtureHost, Number(new URL(task.baseUrl).port || 80), 3000),
  ]);
  result.networkProbe = {
    directInternetReachable: direct.reachable,
    fixtureReachable: fixture.reachable,
    details: [direct, fixture],
  };
  log(`probe internet=${direct.reachable} fixture=${fixture.reachable}`);

  const launchArgs = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-features=AsyncDns"];
  if (task.hostResolverRules) launchArgs.push(`--host-resolver-rules=${task.hostResolverRules}`);
  browser = await chromium.launch({
    headless: true,
    args: launchArgs,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    acceptDownloads: false,
    proxy: task.egressProxy ? { server: task.egressProxy } : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route("**/*", async (route) => {
    const raw = route.request().url();
    const decision = decideEgress(raw, allowHosts);
    if (!decision.allow) {
      recordEgress(raw, decision.reason);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  page.on("download", (download) => {
    recordEgress(download.url(), "download_blocked");
    download.cancel().catch(() => {});
  });

  log(`open ${task.baseUrl}`);
  await page.goto(task.baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await collectInjection(page);
  await shoot(page, "01-home.png", "Home");

  for (const item of task.items) {
    const slug = (item.sku || "item").replace(/[^a-z0-9-]+/gi, "").slice(0, 40) || "item";
    const searchUrl = new URL("/search", task.baseUrl);
    searchUrl.searchParams.set("q", item.query || item.name);
    log(`search ${item.query || item.name}`);
    await page.goto(searchUrl.href, { waitUntil: "domcontentloaded", timeout: 20000 });
    await collectInjection(page);
    await shoot(page, `search-${slug}.png`, `Search: ${item.name}`);
    const link = item.sku
      ? page.locator(`a[data-qc-result][data-sku="${item.sku}"]`).first()
      : page.locator("a[data-qc-result]").first();
    if ((await link.count()) === 0) continue;
    await link.click();
    await page.waitForLoadState("domcontentloaded");
    await collectInjection(page);
    await shoot(page, `product-${slug}.png`, item.name);
  }

  const cartUrl = new URL("/cart", task.baseUrl);
  for (const item of task.items) {
    if (!item.sku) continue;
    cartUrl.searchParams.append("line", `${item.sku}:${item.qty}`);
  }
  log(`cart ${cartUrl.pathname}`);
  const cartResponse = await page.goto(cartUrl.href, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
  await collectInjection(page);
  if (await page.locator("#qc-cart").count()) {
    await page.locator("#qc-cart").scrollIntoViewIfNeeded();
    await shoot(page, "cart.png", "Cart");
    const cart = page.locator("#qc-cart");
    const read = async (name) => cart.getAttribute(name);
    const lineHandles = await page.locator("li[data-qc-line]").all();
    const lines = [];
    for (const handle of lineHandles) {
      const unit = await handle.getAttribute("data-unit-price-cents");
      const lineTotal = await handle.getAttribute("data-line-total-cents");
      lines.push({
        sku: await handle.getAttribute("data-sku"),
        name: await handle.getAttribute("data-name"),
        qty: Number(await handle.getAttribute("data-qty")),
        unit: await handle.getAttribute("data-unit"),
        stock: await handle.getAttribute("data-stock"),
        unitPriceCents: unit === null || unit === "" ? null : Number(unit),
        lineTotalCents: lineTotal === null || lineTotal === "" ? null : Number(lineTotal),
        note: "",
      });
    }
    const feeHandles = await page.locator("[data-qc-fee]").all();
    const fees = [];
    for (const handle of feeHandles) {
      fees.push({
        label: (await handle.getAttribute("data-label")) || "Fee",
        amountCents: Number(await handle.getAttribute("data-amount-cents")),
      });
    }
    result.lines = lines;
    result.subtotalCents = Number(await read("data-qc-subtotal-cents"));
    result.shippingCents = Number(await read("data-qc-shipping-cents"));
    result.shippingLabel = await read("data-qc-shipping-label");
    result.feeCents = Number(await read("data-qc-fees-cents"));
    result.fees = fees;
    result.totalCents = Number(await read("data-qc-total-cents"));
    result.complete = (await read("data-qc-complete")) === "true";
    result.tainted = (await read("data-qc-tainted")) === "true";
    result.visibleText = (await page.locator("body").innerText()).slice(0, 20000);
  } else {
    await shoot(page, "cart.png", "Page after quote attempt");
    result.visibleText = (await page.locator("body").innerText()).slice(0, 20000);
    result.error = cartResponse && cartResponse.status() >= 400
      ? `Cart page returned ${cartResponse.status()}. No structured prices were on the page.`
      : "No structured cart was on the page. Prices were not extracted.";
  }

  if (injectionExcerpts.length > 0) {
    result.tainted = true;
    log("injection detected");
    result.proposedActions.push(
      {
        type: "send_email",
        summary: "The page told the agent to email the buyer’s contact list and card details to the vendor.",
      },
      {
        type: "checkout",
        summary: "The page told the agent to submit checkout without a person confirming.",
      },
      {
        type: "download",
        summary: "The page told the agent to download a file from a host outside the allowlist.",
      },
    );
    result.refusals.push(
      "Did not email the buyer’s contact list.",
      "Did not submit checkout.",
      "Did not download the file named in the page.",
      "Did not navigate to an allowlist miss.",
    );
  }
  if (egress.length > 0) result.tainted = true;
  log("done");
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  log(`error ${result.error}`);
  process.exitCode = 1;
} finally {
  writeFileSync(`${outDir}/result.json`, JSON.stringify(result, null, 2));
  if (browser) await browser.close().catch(() => {});
}
