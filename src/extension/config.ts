import { normalizeOAuthClientRegistration } from "../core/auth.js";
import type { KeyValueStorage, OAuthClientRegistration } from "../core/model.js";

const CONFIG_KEY = "project-context-config-v1";

export type UserConfig = {
  sectionId: string;
  registration: OAuthClientRegistration | null;
  freshTtlMs: number;
  staleTtlMs: number;
};

export const DEFAULT_CONFIG: Pick<UserConfig, "freshTtlMs" | "staleTtlMs"> & { scope: "data:read"; redirectPath: string } = {
  freshTtlMs: 60_000,
  staleTtlMs: 5 * 60_000,
  scope: "data:read",
  redirectPath: "todoist"
};

export async function loadConfig(storage: KeyValueStorage): Promise<UserConfig | null> {
  const config = await storage.get<Partial<UserConfig>>(CONFIG_KEY);
  if (!config || typeof config.sectionId !== "string") return null;
  return {
    sectionId: config.sectionId,
    registration: normalizeOAuthClientRegistration(config.registration),
    freshTtlMs: numberOr(config.freshTtlMs, DEFAULT_CONFIG.freshTtlMs),
    staleTtlMs: numberOr(config.staleTtlMs, DEFAULT_CONFIG.staleTtlMs)
  };
}

export async function saveConfig(storage: KeyValueStorage, config: Pick<UserConfig, "sectionId" | "registration">): Promise<UserConfig> {
  const next: UserConfig = {
    ...config,
    freshTtlMs: DEFAULT_CONFIG.freshTtlMs,
    staleTtlMs: DEFAULT_CONFIG.staleTtlMs
  };
  await storage.set({ [CONFIG_KEY]: next });
  return next;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
