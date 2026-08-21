import {
  buildProjectContextSnapshot,
  isProjectDashboardRoot,
  summarizeProjectContextRoot
} from "./projection.js";
import type {
  KeyValueStorage,
  ProjectContextFreshness,
  ProjectContextReader,
  ProjectContextRootDiscoveryProjection,
  ProjectContextSelectionProjection,
  ProjectContextSnapshot,
  TodoistProjectContextRootDiscovery
} from "./model.js";

export const PROJECT_CONTEXT_CACHE_KEY = "project-context-cache-v1";
const DEFAULT_FRESH_TTL_MS = 60_000;
const DEFAULT_STALE_TTL_MS = 5 * 60_000;

export type ProjectContextCacheOptions = {
  storage?: KeyValueStorage;
  freshTtlMs?: number;
  staleTtlMs?: number;
  now?: () => number;
};

export class ProjectContextCacheError extends Error {
  constructor(public readonly code: "unavailable" | "provider_unavailable" | "invalid_selection", message: string) {
    super(message);
  }
}

type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
  expiresAt: number;
  staleUntil: number;
  error: boolean;
};

type CacheEnvelope = {
  schemaVersion: 1;
  discovery?: CacheEntry<ProjectContextRootDiscoveryProjection>;
  snapshots: Record<string, CacheEntry<ProjectContextSnapshot>>;
};

export class ProjectContextCache {
  private readonly freshTtlMs: number;
  private readonly staleTtlMs: number;
  private readonly now: () => number;
  private discoveryEntry: CacheEntry<ProjectContextRootDiscoveryProjection> | undefined;
  private discoveryInFlight: Promise<ProjectContextRootDiscoveryProjection> | undefined;
  private readonly snapshotEntries = new Map<string, CacheEntry<ProjectContextSnapshot>>();
  private readonly snapshotInFlight = new Map<string, Promise<ProjectContextSnapshot>>();
  private hydration: Promise<void> | undefined;

  constructor(
    private readonly reader: ProjectContextReader,
    private readonly sectionId: string,
    private readonly options: ProjectContextCacheOptions = {}
  ) {
    this.freshTtlMs = options.freshTtlMs ?? DEFAULT_FRESH_TTL_MS;
    this.staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
    this.now = options.now ?? Date.now;
    if (!Number.isFinite(this.freshTtlMs) || this.freshTtlMs <= 0) throw new Error("fresh cache TTL must be positive");
    if (!Number.isFinite(this.staleTtlMs) || this.staleTtlMs <= 0) throw new Error("stale cache TTL must be positive");
    if (!sectionId.trim()) throw new Error("sectionId must be configured");
  }

  async readRoots(forceRefresh = false): Promise<ProjectContextRootDiscoveryProjection> {
    await this.ensureHydrated();
    const entry = this.discoveryEntry;
    const now = this.now();
    if (!forceRefresh && entry && now < entry.expiresAt) return this.discoveryProjection(entry, now);
    if (!forceRefresh && entry && now < entry.staleUntil) {
      void this.refreshDiscovery(entry);
      return this.discoveryProjection(entry, now);
    }
    const value = await this.refreshDiscovery(entry);
    const current = this.discoveryEntry;
    if (!current || current.value !== value) {
      return this.discoveryProjection(this.newEntry(value, this.now(), false), this.now());
    }
    return this.discoveryProjection(current, this.now());
  }

  async readSelection(requestedId?: string, forceRefresh = false): Promise<ProjectContextSelectionProjection> {
    const discovery = await this.readRoots(forceRefresh);
    if (discovery.roots.length === 0) {
      throw new ProjectContextCacheError("unavailable", "No project-context roots were found in the configured section");
    }
    const selectedId = requestedId ?? discovery.roots[0]!.id;
    if (!discovery.roots.some((root) => root.id === selectedId)) {
      throw new ProjectContextCacheError("invalid_selection", "Selected root is outside the configured section boundary");
    }
    const snapshot = await this.readSnapshot(selectedId, forceRefresh);
    return {
      roots: discovery.roots,
      discoveryCoverage: discovery.coverage,
      snapshot: snapshot.snapshot,
      freshness: { discovery: discovery.freshness, snapshot: snapshot.freshness }
    };
  }

  private async readSnapshot(rootTaskId: string, forceRefresh: boolean): Promise<{ snapshot: ProjectContextSnapshot; freshness: ProjectContextFreshness }> {
    const entry = this.snapshotEntries.get(rootTaskId);
    const now = this.now();
    if (!forceRefresh && entry && now < entry.expiresAt) return { snapshot: entry.value, freshness: this.snapshotFreshness(entry, now) };
    if (!forceRefresh && entry && now < entry.staleUntil) {
      void this.refreshSnapshot(rootTaskId, entry);
      return { snapshot: entry.value, freshness: this.snapshotFreshness(entry, now) };
    }
    const snapshot = await this.refreshSnapshot(rootTaskId, entry);
    const current = this.snapshotEntries.get(rootTaskId);
    const next = current && current.value === snapshot ? current : this.newEntry(snapshot, this.now(), false);
    return { snapshot, freshness: this.snapshotFreshness(next, this.now()) };
  }

  private refreshDiscovery(existing: CacheEntry<ProjectContextRootDiscoveryProjection> | undefined): Promise<ProjectContextRootDiscoveryProjection> {
    if (this.discoveryInFlight) return this.discoveryInFlight;
    const flight = this.reader.readProjectContextRoots(this.sectionId)
      .then((result) => this.projectDiscovery(result))
      .then((value) => {
        this.discoveryEntry = this.newEntry(value, this.now(), false);
        void this.persist();
        return value;
      })
      .catch((error: unknown) => {
        if (existing && this.now() < existing.staleUntil) {
          existing.error = true;
          void this.persist();
          return existing.value;
        }
        if (error instanceof ProjectContextCacheError) throw error;
        throw new ProjectContextCacheError("provider_unavailable", "Todoist project context provider unavailable");
      });
    this.discoveryInFlight = flight;
    void flight.then(() => {
      if (this.discoveryInFlight === flight) this.discoveryInFlight = undefined;
    }, () => {
      if (this.discoveryInFlight === flight) this.discoveryInFlight = undefined;
    });
    return flight;
  }

  private refreshSnapshot(rootTaskId: string, existing: CacheEntry<ProjectContextSnapshot> | undefined): Promise<ProjectContextSnapshot> {
    const current = this.snapshotInFlight.get(rootTaskId);
    if (current) return current;
    const flight = this.reader.readProjectContext(rootTaskId, new Date(this.now()))
      .then((source) => buildProjectContextSnapshot(source))
      .then((snapshot) => {
        this.snapshotEntries.set(rootTaskId, this.newEntry(snapshot, this.now(), false));
        void this.persist();
        return snapshot;
      })
      .catch((error: unknown) => {
        if (existing && this.now() < existing.staleUntil) {
          existing.error = true;
          void this.persist();
          return existing.value;
        }
        if (error instanceof ProjectContextCacheError) throw error;
        throw new ProjectContextCacheError("provider_unavailable", "Todoist project context provider unavailable");
      });
    this.snapshotInFlight.set(rootTaskId, flight);
    void flight.then(() => {
      if (this.snapshotInFlight.get(rootTaskId) === flight) this.snapshotInFlight.delete(rootTaskId);
    }, () => {
      if (this.snapshotInFlight.get(rootTaskId) === flight) this.snapshotInFlight.delete(rootTaskId);
    });
    return flight;
  }

  private projectDiscovery(result: TodoistProjectContextRootDiscovery): ProjectContextRootDiscoveryProjection {
    const roots = result.roots.filter(isProjectDashboardRoot).map(summarizeProjectContextRoot);
    return {
      roots,
      coverage: { ...result.coverage, rootTasksRead: roots.length },
      freshness: this.newFreshness(0, false, false)
    };
  }

  private discoveryProjection(entry: CacheEntry<ProjectContextRootDiscoveryProjection>, now: number): ProjectContextRootDiscoveryProjection {
    return { ...entry.value, freshness: this.freshness(entry, now, Boolean(this.discoveryInFlight)) };
  }

  private snapshotFreshness(entry: CacheEntry<ProjectContextSnapshot>, now: number): ProjectContextFreshness {
    return this.freshness(entry, now, this.snapshotInFlight.has(entry.value.id));
  }

  private freshness<T>(entry: CacheEntry<T>, now: number, refreshing: boolean): ProjectContextFreshness {
    const state = now < entry.expiresAt ? "fresh" : now < entry.staleUntil ? "stale" : "expired";
    return {
      state,
      updatedAt: new Date(entry.fetchedAt).toISOString(),
      ageMs: Math.max(0, now - entry.fetchedAt),
      refreshing,
      error: entry.error ? "provider_unavailable" : null
    };
  }

  private newFreshness(ageMs: number, refreshing: boolean, error: boolean): ProjectContextFreshness {
    return {
      state: "fresh",
      updatedAt: new Date(this.now() - ageMs).toISOString(),
      ageMs,
      refreshing,
      error: error ? "provider_unavailable" : null
    };
  }

  private newEntry<T>(value: T, fetchedAt: number, error: boolean): CacheEntry<T> {
    return { value, fetchedAt, expiresAt: fetchedAt + this.freshTtlMs, staleUntil: fetchedAt + this.freshTtlMs + this.staleTtlMs, error };
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydration) return this.hydration;
    this.hydration = (async () => {
      const stored = await this.options.storage?.get<CacheEnvelope>(PROJECT_CONTEXT_CACHE_KEY);
      if (!stored || stored.schemaVersion !== 1 || !stored.snapshots) return;
      if (stored.discovery) this.discoveryEntry = stored.discovery;
      for (const [id, entry] of Object.entries(stored.snapshots)) this.snapshotEntries.set(id, entry);
    })().catch(() => undefined);
    return this.hydration;
  }

  private async persist(): Promise<void> {
    if (!this.options.storage) return;
    const snapshots: Record<string, CacheEntry<ProjectContextSnapshot>> = {};
    for (const [id, entry] of this.snapshotEntries) snapshots[id] = entry;
    await this.options.storage.set({
      [PROJECT_CONTEXT_CACHE_KEY]: { schemaVersion: 1, discovery: this.discoveryEntry, snapshots } satisfies CacheEnvelope
    });
  }
}
