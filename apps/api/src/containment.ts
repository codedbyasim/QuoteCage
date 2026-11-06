import { assertEnvEntriesSafe } from "../../../shared/policy.mjs";

export function sandboxEnvList(): string[] {
  return [
    "HOME=/tmp/home",
    "TMPDIR=/tmp",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright",
    "LANG=C.UTF-8",
    "NODE_ENV=production",
    "XDG_CACHE_HOME=/tmp/cache",
    "XDG_CONFIG_HOME=/tmp/config",
  ];
}

export type SandboxSpecInput = {
  image: string;
  network: string;
  runtime: string;
  memoryBytes: number;
  cpus: number;
  pids: number;
  taskHostPath: string;
  outHostPath: string;
  runId: string;
  vendorId: string;
  extraHosts?: string[];
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function proxyPort(proxyUrl: string): number {
  try {
    const port = new URL(proxyUrl).port;
    return port ? Number(port) : 3128;
  } catch {
    return 3128;
  }
}

export function sandboxNetworkAliases(
  containers: { name: string; ipv4: string }[],
  fixtureHosts: string[],
  port: number,
) {
  const egress = containers.find((container) => container.name.includes("egress") && IPV4.test(container.ipv4));
  const fixtures = containers.find((container) => container.name.includes("fixtures") && IPV4.test(container.ipv4));
  const extraHosts: string[] = [];
  const rules: string[] = [];
  if (egress) {
    extraHosts.push(`egress:${egress.ipv4}`);
    rules.push(`MAP egress ${egress.ipv4}`);
  }
  if (fixtures) {
    for (const host of fixtureHosts) {
      extraHosts.push(`${host}:${fixtures.ipv4}`);
      rules.push(`MAP ${host} ${fixtures.ipv4}`);
    }
  }
  return {
    extraHosts,
    hostResolverRules: rules.join(", "),
    proxyUrl: egress ? `http://${egress.ipv4}:${port}` : null,
    proxyHost: egress?.ipv4 ?? null,
  };
}

export function isGvisorProxyFailure(text: string): boolean {
  return /ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED/.test(text);
}

export function gvisorProxyFallbackNote(detail: string): string {
  return `gVisor (runsc) could not reach the egress proxy (${detail}). QuoteCage continued with runc so this comparison can finish. The sandbox stays on the internal network with the same allowlist, limits, and secret rules. Re-run deploy/setup-vultr.sh with INSTALL_GVISOR=1 so runsc is registered with --network=host, then restart Docker.`;
}

export function buildCreateOptions(input: SandboxSpecInput) {
  const env = sandboxEnvList();
  const violations = assertEnvEntriesSafe(env);
  if (violations.length > 0) {
    throw new Error("Refusing to start a sandbox with a secret-like environment.");
  }
  return {
    Image: input.image,
    User: "pwuser",
    Env: env,
    Cmd: ["node", "/app/worker.mjs", "/task/task.json", "/out"],
    WorkingDir: "/app",
    Labels: {
      "quotecage.role": "sandbox",
      "quotecage.run": input.runId,
      "quotecage.vendor": input.vendorId,
    },
    HostConfig: {
      Memory: input.memoryBytes,
      MemorySwap: input.memoryBytes,
      NanoCpus: Math.round(input.cpus * 1e9),
      PidsLimit: input.pids,
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      CapAdd: [] as string[],
      Privileged: false,
      SecurityOpt: ["no-new-privileges:true"],
      NetworkMode: input.network,
      Runtime: input.runtime,
      ShmSize: 256 * 1024 * 1024,
      Init: true,
      AutoRemove: false,
      Tmpfs: {
        "/tmp": "rw,nosuid,nodev,size=512m",
      },
      Binds: [`${input.taskHostPath}:/task:ro`, `${input.outHostPath}:/out:rw`],
      ...(input.extraHosts && input.extraHosts.length > 0 ? { ExtraHosts: input.extraHosts } : {}),
    },
  };
}

export function summarizeInspect(inspect: {
  Id?: string;
  Config?: { User?: string; Image?: string; Env?: string[] };
  HostConfig?: {
    Memory?: number;
    MemorySwap?: number;
    NanoCpus?: number;
    PidsLimit?: number;
    ReadonlyRootfs?: boolean;
    CapDrop?: string[];
    CapAdd?: string[];
    SecurityOpt?: string[];
    NetworkMode?: string;
    Runtime?: string;
    Privileged?: boolean;
    ShmSize?: number;
  };
}) {
  const env = inspect.Config?.Env || [];
  return {
    id: inspect.Id || null,
    user: inspect.Config?.User || null,
    image: inspect.Config?.Image || null,
    envNames: env.map((entry) => entry.split("=")[0]),
    memory: inspect.HostConfig?.Memory ?? null,
    memorySwap: inspect.HostConfig?.MemorySwap ?? null,
    nanoCpus: inspect.HostConfig?.NanoCpus ?? null,
    pidsLimit: inspect.HostConfig?.PidsLimit ?? null,
    readonlyRootfs: inspect.HostConfig?.ReadonlyRootfs ?? null,
    capDrop: inspect.HostConfig?.CapDrop || [],
    capAdd: inspect.HostConfig?.CapAdd || [],
    securityOpt: inspect.HostConfig?.SecurityOpt || [],
    networkMode: inspect.HostConfig?.NetworkMode || null,
    runtime: inspect.HostConfig?.Runtime || null,
    privileged: Boolean(inspect.HostConfig?.Privileged),
    shmSize: inspect.HostConfig?.ShmSize ?? null,
    secretsInEnv: assertEnvEntriesSafe(env).length,
  };
}

export function demuxDockerLogs(buffer: Buffer): string {
  if (buffer.length === 0) return "";
  const chunks: string[] = [];
  let offset = 0;
  if (buffer[0] === 1 || buffer[0] === 2) {
    while (offset + 8 <= buffer.length) {
      const size = buffer.readUInt32BE(offset + 4);
      if (size < 0 || offset + 8 + size > buffer.length) break;
      chunks.push(buffer.subarray(offset + 8, offset + 8 + size).toString("utf8"));
      offset += 8 + size;
    }
  }
  const text = chunks.length > 0 ? chunks.join("") : buffer.toString("utf8");
  return text.slice(-4000);
}
