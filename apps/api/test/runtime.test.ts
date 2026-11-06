import assert from "node:assert/strict";
import test from "node:test";
import { selectSandboxRuntime, type ContainerLike, type DockerLike } from "../src/runner.ts";

function fakeDocker(statusCode: number, runtimes: Record<string, unknown> = { runsc: {} }): DockerLike & { created: unknown[] } {
  const created: unknown[] = [];
  const gone = {
    inspect: async () => {
      throw new Error("gone");
    },
  };
  return {
    created,
    info: async () => ({ Runtimes: runtimes }),
    createContainer: async (options: unknown) => {
      created.push(options);
      const container: ContainerLike = {
        id: "probe",
        inspect: async () => ({ Id: "probe" }),
        start: async () => undefined,
        wait: async () => ({ StatusCode: statusCode }),
        kill: async () => undefined,
        remove: async () => undefined,
        logs: async () => Buffer.from(statusCode === 0 ? "proxy_ok\n" : "ENETUNREACH\n"),
      };
      return container;
    },
    getContainer: () => gone as ContainerLike,
    listContainers: async () => [],
  };
}

test("runsc is kept when the egress proxy answers", async () => {
  const docker = fakeDocker(0);
  const choice = await selectSandboxRuntime(docker, "runsc", {
    image: "quotecage-sandbox:local",
    network: "quotecage_sandbox",
    proxyHost: "172.19.0.3",
    proxyPort: 3128,
  });
  assert.equal(choice.runtime, "runsc");
  assert.equal(choice.note, null);
  const spec = docker.created[0] as { Env: string[]; HostConfig: { Runtime: string; NetworkMode: string; Binds: string[] } };
  assert.equal(spec.HostConfig.Runtime, "runsc");
  assert.equal(spec.HostConfig.NetworkMode, "quotecage_sandbox");
  assert.deepEqual(spec.HostConfig.Binds, []);
  assert.equal(spec.Env.includes("PROBE_HOST=172.19.0.3"), true);
  assert.equal(spec.Env.some((entry) => entry.includes("VULTR")), false);
});

test("runsc falls back to runc when the proxy probe fails", async () => {
  const choice = await selectSandboxRuntime(fakeDocker(2), "runsc", {
    image: "quotecage-sandbox:local",
    network: "quotecage_sandbox",
    proxyHost: "172.19.0.3",
    proxyPort: 3128,
  });
  assert.equal(choice.runtime, "runc");
  assert.match(choice.note || "", /continued with runc/);
  assert.match(choice.note || "", /--network=host/);
});

test("a missing runsc runtime falls back without starting a probe", async () => {
  const docker = fakeDocker(0, {});
  const choice = await selectSandboxRuntime(docker, "runsc", {
    image: "quotecage-sandbox:local",
    network: "quotecage_sandbox",
    proxyHost: "172.19.0.3",
    proxyPort: 3128,
  });
  assert.equal(choice.runtime, "runc");
  assert.match(choice.note || "", /not installed/);
  assert.equal(docker.created.length, 0);
});
