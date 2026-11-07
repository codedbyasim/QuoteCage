export type InferenceMode = "auto" | "mock" | "live";

export type Config = {
  port: number;
  host: string;
  dataDir: string;
  workDir: string;
  hostWorkDir: string;
  allowDir: string;
  dockerSocket: string;
  sandboxImage: string;
  sandboxNetwork: string;
  sandboxRuntime: string;
  memoryBytes: number;
  cpus: number;
  pids: number;
  timeoutMs: number;
  inferenceMode: InferenceMode;
  inferenceKey: string;
  inferenceBase: string;
  plannerModel: string;
  visionModel: string;
  allowLiveUrls: boolean;
  demoPassword: string;
  cookieSecure: boolean;
  egressProxy: string;
  rateLimitRuns: number;
  rateWindowMs: number;
};

export function parseMemory(value: string): number {
  const match = /^(\d+(?:\.\d+)?)([mMgG])?$/.exec(value.trim());
  if (!match) throw new Error(`Bad SANDBOX_MEMORY value: ${value}`);
  const amount = Number(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  if (unit === "g") return Math.round(amount * 1024 * 1024 * 1024);
  if (unit === "m") return Math.round(amount * 1024 * 1024);
  return Math.round(amount);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = env.INFERENCE_MODE || "auto";
  if (mode !== "auto" && mode !== "mock" && mode !== "live") {
    throw new Error("INFERENCE_MODE must be auto, mock, or live.");
  }
  return {
    port: Number(env.PORT || 8080),
    host: env.HOST || "0.0.0.0",
    dataDir: env.DATA_DIR || "/var/quotecage/data",
    workDir: env.WORK_DIR || "/var/quotecage/work",
    hostWorkDir: env.HOST_WORK_DIR || env.WORK_DIR || "/var/quotecage/work",
    allowDir: env.ALLOW_DIR || "/var/quotecage/allow",
    dockerSocket: env.DOCKER_SOCKET || "/var/run/docker.sock",
    sandboxImage: env.SANDBOX_IMAGE || "quotecage-sandbox:local",
    sandboxNetwork: env.SANDBOX_NETWORK || "quotecage_sandbox",
    sandboxRuntime: env.SANDBOX_RUNTIME || "runc",
    memoryBytes: parseMemory(env.SANDBOX_MEMORY || "1280m"),
    cpus: Number(env.SANDBOX_CPUS || "1"),
    pids: Number(env.SANDBOX_PIDS || "512"),
    timeoutMs: Number(env.SANDBOX_TIMEOUT_MS || "120000"),
    inferenceMode: mode,
    inferenceKey: env.VULTR_INFERENCE_API_KEY || "",
    inferenceBase: (env.VULTR_INFERENCE_BASE_URL || "https://api.vultrinference.com/v1").replace(/\/$/, ""),
    plannerModel: env.VULTR_PLANNER_MODEL || "glm-5.3-flash",
    visionModel: env.VULTR_VISION_MODEL || "glm-5.3-flash",
    allowLiveUrls: env.ALLOW_LIVE_URLS !== "false",
    demoPassword: env.DEMO_PASSWORD || "",
    cookieSecure: env.COOKIE_SECURE === "true",
    egressProxy: env.EGRESS_PROXY || "http://egress:3128",
    rateLimitRuns: Number(env.RATE_LIMIT_RUNS || 6),
    rateWindowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
  };
}

export function resolveInferenceMode(config: Config): "mock" | "live" {
  if (config.inferenceMode === "mock") return "mock";
  if (config.inferenceMode === "live") return "live";
  return config.inferenceKey ? "live" : "mock";
}
