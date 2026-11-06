import assert from "node:assert/strict";
import test from "node:test";
import { assertEnvEntriesSafe } from "../../../shared/policy.mjs";
import { buildCreateOptions, demuxDockerLogs, isGvisorProxyFailure, sandboxEnvList, sandboxNetworkAliases, summarizeInspect } from "../src/containment.ts";

test("sandbox env is a fixed list and ignores the control plane environment", () => {
  process.env.VULTR_INFERENCE_API_KEY = "super-secret-value";
  process.env.DEMO_PASSWORD = "hunter2";
  const env = sandboxEnvList();
  assert.equal(env.some((entry) => entry.includes("super-secret-value")), false);
  assert.equal(env.some((entry) => entry.includes("hunter2")), false);
  assert.equal(env.some((entry) => entry.startsWith("VULTR")), false);
  assert.equal(env.some((entry) => entry.startsWith("DEMO_PASSWORD")), false);
  assert.deepEqual(assertEnvEntriesSafe(env), []);
});

test("container spec sets limits, drops privileges, and mounts only the task and output", () => {
  const spec = buildCreateOptions({
    image: "quotecage-sandbox:local",
    network: "quotecage_sandbox",
    runtime: "runc",
    memoryBytes: 1280 * 1024 * 1024,
    cpus: 1,
    pids: 512,
    taskHostPath: "/var/quotecage/work/run/vendor/task",
    outHostPath: "/var/quotecage/work/run/vendor/out",
    runId: "run",
    vendorId: "reedmill",
  });
  assert.equal(spec.User, "pwuser");
  assert.equal(spec.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(spec.HostConfig.CapDrop, ["ALL"]);
  assert.deepEqual(spec.HostConfig.CapAdd, []);
  assert.equal(spec.HostConfig.Privileged, false);
  assert.ok(spec.HostConfig.SecurityOpt.includes("no-new-privileges:true"));
  assert.equal(spec.HostConfig.Memory, 1280 * 1024 * 1024);
  assert.equal(spec.HostConfig.MemorySwap, spec.HostConfig.Memory);
  assert.equal(spec.HostConfig.PidsLimit, 512);
  assert.equal(spec.HostConfig.NanoCpus, 1_000_000_000);
  assert.equal(spec.HostConfig.NetworkMode, "quotecage_sandbox");
  assert.equal(spec.HostConfig.Runtime, "runc");
  assert.deepEqual(spec.HostConfig.Binds, [
    "/var/quotecage/work/run/vendor/task:/task:ro",
    "/var/quotecage/work/run/vendor/out:/out:rw",
  ]);
  assert.equal(spec.Env.includes("VULTR_INFERENCE_API_KEY=super-secret-value"), false);
});

test("inspect summary keeps env names and drops values", () => {
  const summary = summarizeInspect({
    Id: "abc",
    Config: { User: "pwuser", Env: ["HOME=/tmp/home", "VULTR_INFERENCE_API_KEY=nope"] },
    HostConfig: { ReadonlyRootfs: true, CapDrop: ["ALL"], Privileged: false, PidsLimit: 512 },
  });
  assert.deepEqual(summary.envNames, ["HOME", "VULTR_INFERENCE_API_KEY"]);
  assert.equal(JSON.stringify(summary).includes("nope"), false);
  assert.equal(summary.secretsInEnv > 0, true);
});

test("sandbox aliases point fixture names at the sandbox-network addresses only", () => {
  const aliases = sandboxNetworkAliases(
    [
      { name: "quotecage-egress-1", ipv4: "172.19.0.3" },
      { name: "quotecage-fixtures-1", ipv4: "172.19.0.2" },
    ],
    ["reedmill.fixtures", "quickquote.fixtures"],
    3128,
  );
  assert.equal(aliases.proxyUrl, "http://172.19.0.3:3128");
  assert.deepEqual(aliases.extraHosts, [
    "egress:172.19.0.3",
    "reedmill.fixtures:172.19.0.2",
    "quickquote.fixtures:172.19.0.2",
  ]);
  assert.equal(aliases.extraHosts.some((entry) => entry.includes("exfil.evil")), false);
  assert.match(aliases.hostResolverRules, /MAP egress 172\.19\.0\.3/);
});

test("chromium proxy failures are recognized and other network errors are not", () => {
  assert.equal(isGvisorProxyFailure("page.goto: net::ERR_PROXY_CONNECTION_FAILED at http://reedmill.fixtures/"), true);
  assert.equal(isGvisorProxyFailure("probe internet=false error=ENETUNREACH"), false);
});

test("docker log frames are stripped", () => {
  const payload = Buffer.from("hello sandbox");
  const frame = Buffer.alloc(8 + payload.length);
  frame[0] = 1;
  frame.writeUInt32BE(payload.length, 4);
  payload.copy(frame, 8);
  assert.equal(demuxDockerLogs(frame), "hello sandbox");
});
