import type { KeyValueStorage, OAuthConfig } from "../core/model.js";

const CONFIG_KEY = "project-context-config-v1";

export type UserConfig = OAuthConfig & {
  sectionId: string;
  freshTtlMs: number;
  staleTtlMs: number;
};

export const DEFAULT_CONFIG: Pick<UserConfig, "scope" | "redirectPath" | "freshTtlMs" | "staleTtlMs"> = {
  scope: "data:read",
  redirectPath: "todoist",
  freshTtlMs: 60_000,
  staleTtlMs: 5 * 60_000
};

export async function loadConfig(storage: KeyValueStorage): Promise<UserConfig | null> {
  const config = await storage.get<Partial<UserConfig>>(CONFIG_KEY);
  if (!config || typeof config.sectionId !== "string" || typeof config.clientId !== "string") return null;
  return {
    sectionId: config.sectionId,
    clientId: config.clientId,
    scope: "data:read",
    redirectPath: DEFAULT_CONFIG.redirectPath,
    freshTtlMs: numberOr(config.freshTtlMs, DEFAULT_CONFIG.freshTtlMs),
    staleTtlMs: numberOr(config.staleTtlMs, DEFAULT_CONFIG.staleTtlMs)
  };
}

export async function saveConfig(storage: KeyValueStorage, config: Pick<UserConfig, "sectionId" | "clientId">): Promise<UserConfig> {
  const next: UserConfig = {
    ...config,
    scope: DEFAULT_CONFIG.scope,
    redirectPath: DEFAULT_CONFIG.redirectPath,
    freshTtlMs: DEFAULT_CONFIG.freshTtlMs,
    staleTtlMs: DEFAULT_CONFIG.staleTtlMs
  };
  await storage.set({ [CONFIG_KEY]: next });
  return next;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
