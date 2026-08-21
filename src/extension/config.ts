import { normalizeOAuthClientRegistration } from "../core/auth.js";
import type { KeyValueStorage, OAuthClientRegistration, ProjectContextContext } from "../core/model.js";

const CONFIG_KEY = "project-context-config-v1";

export type UserConfig = {
  contexts: ContextConfig[];
  selectedContextKey: string | null;
  registration: OAuthClientRegistration | null;
  freshTtlMs: number;
  staleTtlMs: number;
  needsMigration?: boolean;
};

export type ContextConfig = ProjectContextContext;

export type SaveConfigInput = {
  contexts?: ContextConfig[];
  selectedContextKey?: string | null;
  /** Compatibility input for callers migrating the original one-section config. */
  sectionId?: string;
  registration: OAuthClientRegistration | null;
};

export const DEFAULT_CONFIG: Pick<UserConfig, "freshTtlMs" | "staleTtlMs"> & { scope: "data:read"; redirectPath: string } = {
  freshTtlMs: 60_000,
  staleTtlMs: 5 * 60_000,
  scope: "data:read",
  redirectPath: "todoist"
};

export async function loadConfig(storage: KeyValueStorage): Promise<UserConfig | null> {
  const config = await storage.get<Partial<UserConfig> & { sectionId?: unknown }>(CONFIG_KEY);
  if (!config || typeof config !== "object") return null;
  const legacySectionId = typeof config.sectionId === "string" ? config.sectionId.trim() : "";
  const contexts = normalizeContexts(config.contexts, legacySectionId);
  const hasRegistration = Boolean(normalizeOAuthClientRegistration(config.registration));
  if (contexts.length === 0 && !hasRegistration) return null;
  return {
    contexts,
    selectedContextKey: selectContextKey(contexts, config.selectedContextKey),
    registration: normalizeOAuthClientRegistration(config.registration),
    freshTtlMs: numberOr(config.freshTtlMs, DEFAULT_CONFIG.freshTtlMs),
    staleTtlMs: numberOr(config.staleTtlMs, DEFAULT_CONFIG.staleTtlMs),
    ...(legacySectionId && !Array.isArray(config.contexts) ? { needsMigration: true } : {})
  };
}

export async function saveConfig(storage: KeyValueStorage, config: SaveConfigInput): Promise<UserConfig> {
  const contexts = normalizeContexts(config.contexts, typeof config.sectionId === "string" ? config.sectionId.trim() : "");
  const next: UserConfig = {
    contexts,
    selectedContextKey: selectContextKey(contexts, config.selectedContextKey),
    registration: normalizeOAuthClientRegistration(config.registration),
    freshTtlMs: DEFAULT_CONFIG.freshTtlMs,
    staleTtlMs: DEFAULT_CONFIG.staleTtlMs
  };
  await storage.set({ [CONFIG_KEY]: next });
  return next;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeContexts(value: unknown, legacySectionId: string): ContextConfig[] {
  const candidates = Array.isArray(value)
    ? value
    : legacySectionId
      ? [{ localKey: "default", label: "Current context", sectionId: legacySectionId }]
      : [];
  const contexts: ContextConfig[] = [];
  const usedKeys = new Set<string>();
  for (const [index, candidate] of candidates.entries()) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const sectionId = typeof record.sectionId === "string" ? record.sectionId.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!sectionId || !label) continue;
    const requestedKey = typeof record.localKey === "string" ? record.localKey.trim() : "";
    const baseKey = requestedKey && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(requestedKey) ? requestedKey : `context-${index + 1}`;
    let localKey = baseKey;
    let suffix = 2;
    while (usedKeys.has(localKey)) localKey = `${baseKey}-${suffix++}`;
    usedKeys.add(localKey);
    contexts.push({ localKey, label: label.slice(0, 120), sectionId: sectionId.slice(0, 200) });
  }
  return contexts;
}

function selectContextKey(contexts: ContextConfig[], requested: unknown): string | null {
  if (typeof requested === "string" && contexts.some((context) => context.localKey === requested)) return requested;
  return contexts[0]?.localKey ?? null;
}
