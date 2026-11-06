import {
  buildCreateOptions,
  demuxDockerLogs,
  gvisorProxyFallbackNote,
  sandboxEnvList,
  sandboxNetworkAliases,
  summarizeInspect,
  type SandboxSpecInput,
} from "./containment.js";

export type ContainerLike = {
  id?: string;
  inspect: () => Promise<{ Id?: string; Config?: { User?: string; Image?: string; Env?: string[] }; HostConfig?: Record<string, unknown> }>;
  start: () => Promise<unknown>;
  wait: () => Promise<{ StatusCode: number }>;
  kill: (opts?: { signal?: string }) => Promise<unknown>;
  remove: (opts?: { force?: boolean }) => Promise<unknown>;
  logs: (opts: { stdout: boolean; stderr: boolean; follow: boolean }) => Promise<Buffer>;
};

export type DockerLike = {
  info: () => Promise<{ Runtimes?: Record<string, unknown> }>;
  createContainer: (options: unknown) => Promise<ContainerLike>;
  getContainer: (id: string) => ContainerLike;
  listContainers: (opts: { all: boolean; filters: { label: string[] } }) => Promise<{ Id: string }[]>;
  getNetwork?: (name: string) => {
    inspect: () => Promise<{ Containers?: Record<string, { Name?: string; IPv4Address?: string }> }>;
  };
};

export type SandboxRun = {
  containerId: string | null;
  exitCode: number | null;
  logs: string;
  inspect: ReturnType<typeof summarizeInspect> | null;
  runtime: string;
  runtimeNote: string | null;
  destroyed: boolean;
  error: string | null;
};

export async function lookupSandboxAliases(docker: DockerLike, networkName: string, fixtureHosts: string[], port: number) {
  if (!docker.getNetwork) return sandboxNetworkAliases([], fixtureHosts, port);
  try {
    const info = await docker.getNetwork(networkName).inspect();
    const containers = Object.values(info.Containers || {})
      .map((container) => ({
        name: String(container.Name || ""),
        ipv4: String(container.IPv4Address || "").split("/")[0],
      }))
      .filter((container) => container.name && container.ipv4);
    return sandboxNetworkAliases(containers, fixtureHosts, port);
  } catch {
    return sandboxNetworkAliases([], fixtureHosts, port);
  }
}

const PROBE_SCRIPT = `
const net = require("net");
const host = process.env.PROBE_HOST;
const port = Number(process.env.PROBE_PORT || 3128);
const socket = net.connect({ host, port, timeout: 4000 }, () => {
  console.log("proxy_ok");
  socket.end();
  process.exit(0);
});
socket.on("timeout", () => { console.error("timeout"); process.exit(2); });
socket.on("error", (error) => { console.error(error.code || error.message); process.exit(2); });
`;

export async function probeEgressProxy(
  docker: DockerLike,
  input: { image: string; network: string; proxyHost: string; proxyPort: number },
): Promise<{ ok: boolean; detail: string }> {
  const spec = buildCreateOptions({
    image: input.image,
    network: input.network,
    runtime: "runsc",
    memoryBytes: 256 * 1024 * 1024,
    cpus: 0.5,
    pids: 128,
    taskHostPath: "/tmp/quotecage-probe-task",
    outHostPath: "/tmp/quotecage-probe-out",
    runId: "probe",
    vendorId: "probe",
  });
  spec.Cmd = ["node", "-e", PROBE_SCRIPT];
  spec.Env = [...sandboxEnvList(), `PROBE_HOST=${input.proxyHost}`, `PROBE_PORT=${input.proxyPort}`];
  spec.Labels["quotecage.role"] = "runtime-probe";
  spec.HostConfig.Binds = [];
  let container: ContainerLike | null = null;
  try {
    container = await docker.createContainer(spec);
    await container.start();
    const status = await waitForExit(container, 20000);
    const logs = await readLogs(container);
    const detail = logs.trim() || `exit ${status.StatusCode}`;
    return { ok: status.StatusCode === 0, detail };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        // The probe is disposable.
      }
    }
  }
}

export async function selectSandboxRuntime(
  docker: DockerLike,
  requested: string,
  probe: { image: string; network: string; proxyHost: string | null; proxyPort: number },
): Promise<{ runtime: string; note: string | null }> {
  if (requested !== "runsc") return { runtime: requested || "runc", note: null };
  let installed = false;
  try {
    const info = await docker.info();
    installed = Object.keys(info.Runtimes || {}).includes("runsc");
  } catch {
    installed = false;
  }
  if (!installed) {
    return {
      runtime: "runc",
      note: "gVisor (runsc) is not installed on this Docker engine. The sandbox used runc.",
    };
  }
  const target = probe.proxyHost || "egress";
  const result = await probeEgressProxy(docker, {
    image: probe.image,
    network: probe.network,
    proxyHost: target,
    proxyPort: probe.proxyPort,
  });
  if (result.ok) return { runtime: "runsc", note: null };
  return { runtime: "runc", note: gvisorProxyFallbackNote(result.detail || `no route to ${target}:${probe.proxyPort}`) };
}

async function chooseRuntime(docker: DockerLike, requested: string) {
  if (requested !== "runsc") return { runtime: requested || "runc", note: null as string | null };
  try {
    const info = await docker.info();
    const names = Object.keys(info.Runtimes || {});
    if (names.includes("runsc")) return { runtime: "runsc", note: null };
  } catch {
    // Fall through to runc and say why.
  }
  return {
    runtime: "runc",
    note: "gVisor (runsc) is not installed on this Docker engine. The sandbox used runc.",
  };
}

export async function runSandbox(
  docker: DockerLike,
  input: SandboxSpecInput,
  timeoutMs: number,
  onLifecycle: (kind: string, message: string, data?: unknown) => void,
): Promise<SandboxRun> {
  const choice = await chooseRuntime(docker, input.runtime);
  const options = buildCreateOptions({ ...input, runtime: choice.runtime });
  if (choice.note) onLifecycle("runtime_fallback", choice.note, { requested: input.runtime, used: choice.runtime });
  const outcome: SandboxRun = {
    containerId: null,
    exitCode: null,
    logs: "",
    inspect: null,
    runtime: choice.runtime,
    runtimeNote: choice.note,
    destroyed: false,
    error: null,
  };
  let container: ContainerLike | null = null;
  try {
    container = await docker.createContainer(options);
    const created = await container.inspect();
    outcome.containerId = created.Id || container.id || null;
    outcome.inspect = summarizeInspect(created);
    onLifecycle("sandbox_created", "Sandbox container created.", outcome.inspect);
    await container.start();
    onLifecycle("sandbox_started", "Sandbox container started.", { id: outcome.containerId });
    const status = await waitForExit(container, timeoutMs);
    outcome.exitCode = status.StatusCode;
    outcome.logs = await readLogs(container);
    outcome.error = status.StatusCode === 0 ? null : `Sandbox process exited ${status.StatusCode}.`;
    onLifecycle("sandbox_exited", `Sandbox exited with code ${status.StatusCode}.`, { id: outcome.containerId, exitCode: status.StatusCode });
  } catch (error) {
    outcome.error = error instanceof Error ? error.message : String(error);
    if (container) outcome.logs = await readLogs(container);
    onLifecycle("sandbox_failed", outcome.error, { id: outcome.containerId });
  } finally {
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        // The inspect below reports whether it is actually gone.
      }
      let still = true;
      if (outcome.containerId) {
        try {
          await docker.getContainer(outcome.containerId).inspect();
        } catch {
          still = false;
        }
      } else {
        still = false;
      }
      outcome.destroyed = !still;
      onLifecycle("sandbox_destroyed", still ? "Sandbox removal was requested but the container is still present." : "Sandbox container destroyed.", {
        id: outcome.containerId,
        stillPresent: still,
      });
    }
  }
  return outcome;
}

async function waitForExit(container: ContainerLike, timeoutMs: number) {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      container.kill({ signal: "SIGKILL" }).catch(() => undefined);
      reject(new Error(`Sandbox exceeded ${timeoutMs}ms and was killed.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([container.wait(), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function readLogs(container: ContainerLike) {
  try {
    const logs = await container.logs({ stdout: true, stderr: true, follow: false });
    return Buffer.isBuffer(logs) ? demuxDockerLogs(logs) : "";
  } catch {
    return "";
  }
}

export async function destroyLeftoverSandboxes(docker: DockerLike) {
  const listed = await docker.listContainers({ all: true, filters: { label: ["quotecage.role=sandbox"] } });
  for (const entry of listed) {
    try {
      await docker.getContainer(entry.Id).remove({ force: true });
    } catch {
      // Best effort on startup.
    }
  }
  return listed.length;
}
