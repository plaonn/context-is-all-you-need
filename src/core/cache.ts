import {
  buildProjectContextSnapshot,
  isProjectDashboardRoot,
  summarizeProjectContextRoot
} from "./projection.js";
import type {
  KeyValueStorage,
  ProjectContextBoardProjection,
  ProjectContextBoardProject,
  ProjectContextContext,
  ProjectContextFreshness,
  ProjectContextReader,
  ProjectContextRootDiscoveryProjection,
  ProjectContextRootSummary,
  ProjectContextSelectionProjection,
  ProjectContextSnapshot,
  TodoistProjectContextRootDiscovery
} from "./model.js";

export const PROJECT_CONTEXT_CACHE_KEY = "project-context-cache-v2";
export const PROJECT_CONTEXT_BOARD_CACHE_KEY = "project-context-board-cache-v2";
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
  schemaVersion: 2;
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
      if (!stored || stored.schemaVersion !== 2 || !stored.snapshots) return;
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
      [PROJECT_CONTEXT_CACHE_KEY]: { schemaVersion: 2, discovery: this.discoveryEntry, snapshots } satisfies CacheEnvelope
    });
  }
}

type BoardCacheState = {
  sectionId: string;
  discovery?: CacheEntry<ProjectContextRootDiscoveryProjection>;
  snapshots: Map<string, CacheEntry<ProjectContextSnapshot>>;
  details: Map<string, CacheEntry<ProjectContextSnapshot>>;
  discoveryInFlight?: Promise<ProjectContextRootDiscoveryProjection>;
  snapshotInFlight: Map<string, Promise<ProjectContextSnapshot>>;
  detailInFlight: Map<string, Promise<ProjectContextSnapshot>>;
};

type BoardCacheEnvelope = {
  schemaVersion: 2;
  contexts: Record<string, {
    sectionId: string;
    discovery?: CacheEntry<ProjectContextRootDiscoveryProjection>;
    snapshots: Record<string, CacheEntry<ProjectContextSnapshot>>;
    details: Record<string, CacheEntry<ProjectContextSnapshot>>;
  }>;
};

export type ProjectContextBoardCacheOptions = ProjectContextCacheOptions & {
  maxProjectConcurrency?: number;
};

/**
 * Selected-context cache. Discovery is shared per local Context, while each
 * project snapshot is cached and refreshed independently so one slow project
 * cannot blank the rest of the board.
 */
export class ProjectContextBoardCache {
  private readonly freshTtlMs: number;
  private readonly staleTtlMs: number;
  private readonly now: () => number;
  private readonly maxProjectConcurrency: number;
  private readonly states = new Map<string, BoardCacheState>();
  private hydration: Promise<void> | undefined;

  constructor(
    private readonly reader: ProjectContextReader,
    private readonly options: ProjectContextBoardCacheOptions = {}
  ) {
    this.freshTtlMs = options.freshTtlMs ?? DEFAULT_FRESH_TTL_MS;
    this.staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
    this.now = options.now ?? Date.now;
    this.maxProjectConcurrency = options.maxProjectConcurrency ?? 4;
    if (!Number.isFinite(this.freshTtlMs) || this.freshTtlMs <= 0) throw new Error("fresh cache TTL must be positive");
    if (!Number.isFinite(this.staleTtlMs) || this.staleTtlMs <= 0) throw new Error("stale cache TTL must be positive");
    if (!Number.isInteger(this.maxProjectConcurrency) || this.maxProjectConcurrency < 1) throw new Error("project concurrency must be a positive integer");
  }

  async readBoard(context: ProjectContextContext, forceRefresh = false): Promise<ProjectContextBoardProjection> {
    await this.ensureHydrated();
    const state = this.stateFor(context);
    const discovery = await this.readDiscovery(context, state, forceRefresh);
    const projects = await this.readProjects(discovery.roots, state, forceRefresh);
    return {
      schemaVersion: 1,
      context,
      projects,
      discoveryCoverage: discovery.coverage,
      freshness: discovery.freshness
    };
  }

  async forgetContext(localKey: string): Promise<void> {
    await this.ensureHydrated();
    this.states.delete(localKey);
    await this.persist();
  }

  async readDetail(context: ProjectContextContext, rootTaskId: string, forceRefresh = false): Promise<ProjectContextSnapshot> {
    await this.ensureHydrated();
    const state = this.stateFor(context);
    const discovery = await this.readDiscovery(context, state, false);
    if (!discovery.roots.some((root) => root.id === rootTaskId)) {
      throw new ProjectContextCacheError("invalid_selection", "Selected project is outside the configured Context boundary");
    }
    const existing = state.details.get(rootTaskId);
    const now = this.now();
    if (!forceRefresh && existing && now < existing.expiresAt) return existing.value;
    if (!forceRefresh && existing && now < existing.staleUntil) {
      void this.refreshDetail(rootTaskId, state, existing);
      return existing.value;
    }
    return this.refreshDetail(rootTaskId, state, existing);
  }

  private async readDiscovery(
    context: ProjectContextContext,
    state: BoardCacheState,
    forceRefresh: boolean
  ): Promise<ProjectContextRootDiscoveryProjection> {
    const entry = state.discovery;
    const now = this.now();
    if (!forceRefresh && entry && now < entry.expiresAt) return this.discoveryProjection(entry, now, state);
    if (!forceRefresh && entry && now < entry.staleUntil) {
      void this.refreshDiscovery(context, state, entry);
      return this.discoveryProjection(entry, now, state);
    }
    const value = await this.refreshDiscovery(context, state, entry);
    const current = state.discovery;
    return current && current.value === value
      ? this.discoveryProjection(current, this.now(), state)
      : this.discoveryProjection(this.newEntry(value, this.now(), false), this.now(), state);
  }

  private async readProjects(
    roots: ProjectContextRootSummary[],
    state: BoardCacheState,
    forceRefresh: boolean
  ): Promise<ProjectContextBoardProject[]> {
    const projects = new Array<ProjectContextBoardProject>(roots.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= roots.length) return;
        const root = roots[index]!;
        projects[index] = await this.readProject(root, state, forceRefresh);
      }
    };
    const workerCount = Math.min(this.maxProjectConcurrency, roots.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return projects.filter((project): project is ProjectContextBoardProject => Boolean(project));
  }

  private async readProject(
    root: ProjectContextRootSummary,
    state: BoardCacheState,
    forceRefresh: boolean
  ): Promise<ProjectContextBoardProject> {
    const existing = state.snapshots.get(root.id);
    const now = this.now();
    if (!forceRefresh && existing && now < existing.expiresAt) return this.boardProject(root, state, existing);
    if (!forceRefresh && existing && now < existing.staleUntil) {
      void this.refreshSnapshot(root.id, state, existing);
      return this.boardProject(root, state, existing);
    }
    try {
      const snapshot = await this.refreshSnapshot(root.id, state, existing);
      const current = state.snapshots.get(root.id);
      return this.boardProject(root, state, current ?? this.newEntry(snapshot, this.now(), false));
    } catch {
      return this.boardProject(root, state, undefined, "provider_unavailable");
    }
  }

  private refreshDiscovery(
    context: ProjectContextContext,
    state: BoardCacheState,
    existing: CacheEntry<ProjectContextRootDiscoveryProjection> | undefined
  ): Promise<ProjectContextRootDiscoveryProjection> {
    if (state.discoveryInFlight) return state.discoveryInFlight;
    const flight = this.reader.readProjectContextRoots(context.sectionId)
      .then((result) => this.projectDiscovery(result))
      .then((value) => {
        state.discovery = this.newEntry(value, this.now(), false);
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
        throw new ProjectContextCacheError("provider_unavailable", "Todoist Context discovery unavailable");
      });
    state.discoveryInFlight = flight;
    void flight.then(() => {
      if (state.discoveryInFlight === flight) state.discoveryInFlight = undefined;
    }, () => {
      if (state.discoveryInFlight === flight) state.discoveryInFlight = undefined;
    });
    return flight;
  }

  private refreshSnapshot(
    rootTaskId: string,
    state: BoardCacheState,
    existing: CacheEntry<ProjectContextSnapshot> | undefined
  ): Promise<ProjectContextSnapshot> {
    const current = state.snapshotInFlight.get(rootTaskId);
    if (current) return current;
    const read = this.reader.readProjectContextCompact
      ? this.reader.readProjectContextCompact(rootTaskId, new Date(this.now()))
      : this.reader.readProjectContext(rootTaskId, new Date(this.now()));
    const flight = read
      .then((source) => buildProjectContextSnapshot(source, "compact"))
      .then((snapshot) => {
        state.snapshots.set(rootTaskId, this.newEntry(snapshot, this.now(), false));
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
        throw new ProjectContextCacheError("provider_unavailable", "Todoist compact project read unavailable");
      });
    state.snapshotInFlight.set(rootTaskId, flight);
    void flight.then(() => {
      if (state.snapshotInFlight.get(rootTaskId) === flight) state.snapshotInFlight.delete(rootTaskId);
    }, () => {
      if (state.snapshotInFlight.get(rootTaskId) === flight) state.snapshotInFlight.delete(rootTaskId);
    });
    return flight;
  }

  private refreshDetail(
    rootTaskId: string,
    state: BoardCacheState,
    existing: CacheEntry<ProjectContextSnapshot> | undefined
  ): Promise<ProjectContextSnapshot> {
    const current = state.detailInFlight.get(rootTaskId);
    if (current) return current;
    const flight = this.reader.readProjectContext(rootTaskId, new Date(this.now()))
      .then((source) => buildProjectContextSnapshot(source, "deep"))
      .then((snapshot) => {
        state.details.set(rootTaskId, this.newEntry(snapshot, this.now(), false));
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
        throw new ProjectContextCacheError("provider_unavailable", "Todoist project detail unavailable");
      });
    state.detailInFlight.set(rootTaskId, flight);
    void flight.then(() => {
      if (state.detailInFlight.get(rootTaskId) === flight) state.detailInFlight.delete(rootTaskId);
    }, () => {
      if (state.detailInFlight.get(rootTaskId) === flight) state.detailInFlight.delete(rootTaskId);
    });
    return flight;
  }

  private boardProject(
    root: ProjectContextRootSummary,
    state: BoardCacheState,
    entry: CacheEntry<ProjectContextSnapshot> | undefined,
    error: "provider_unavailable" | undefined = entry?.error ? "provider_unavailable" : undefined
  ): ProjectContextBoardProject {
    const detailEntry = state.details.get(root.id);
    const visibleEntry = entry ?? detailEntry;
    return {
      root,
      snapshot: visibleEntry?.value ?? null,
      detail: detailEntry?.value ?? null,
      freshness: visibleEntry ? this.freshness(visibleEntry, this.now(), state.snapshotInFlight.has(root.id)) : this.errorFreshness(),
      detailFreshness: detailEntry ? this.freshness(detailEntry, this.now(), state.detailInFlight.has(root.id)) : null,
      error: error ?? null
    };
  }

  private stateFor(context: ProjectContextContext): BoardCacheState {
    if (!context.localKey.trim() || !context.sectionId.trim()) throw new Error("Context mapping must have a key and section");
    const existing = this.states.get(context.localKey);
    if (existing && existing.sectionId === context.sectionId) return existing;
    const state: BoardCacheState = {
      sectionId: context.sectionId,
      snapshots: new Map(),
      details: new Map(),
      snapshotInFlight: new Map(),
      detailInFlight: new Map()
    };
    this.states.set(context.localKey, state);
    return state;
  }

  private projectDiscovery(result: TodoistProjectContextRootDiscovery): ProjectContextRootDiscoveryProjection {
    const roots = result.roots.filter(isProjectDashboardRoot).map(summarizeProjectContextRoot);
    return {
      roots,
      coverage: { ...result.coverage, rootTasksRead: roots.length },
      freshness: this.newFreshness(0, false, false)
    };
  }

  private discoveryProjection(
    entry: CacheEntry<ProjectContextRootDiscoveryProjection>,
    now: number,
    state: BoardCacheState
  ): ProjectContextRootDiscoveryProjection {
    return { ...entry.value, freshness: this.freshness(entry, now, Boolean(state.discoveryInFlight)) };
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

  private errorFreshness(): ProjectContextFreshness {
    return {
      state: "expired",
      updatedAt: new Date(this.now()).toISOString(),
      ageMs: 0,
      refreshing: false,
      error: "provider_unavailable"
    };
  }

  private newEntry<T>(value: T, fetchedAt: number, error: boolean): CacheEntry<T> {
    return { value, fetchedAt, expiresAt: fetchedAt + this.freshTtlMs, staleUntil: fetchedAt + this.freshTtlMs + this.staleTtlMs, error };
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydration) return this.hydration;
    this.hydration = (async () => {
      const stored = await this.options.storage?.get<BoardCacheEnvelope>(PROJECT_CONTEXT_BOARD_CACHE_KEY);
      if (!stored || stored.schemaVersion !== 2 || !stored.contexts) return;
      for (const [localKey, value] of Object.entries(stored.contexts)) {
        const state: BoardCacheState = {
          sectionId: value.sectionId,
          discovery: value.discovery,
          snapshots: new Map(Object.entries(value.snapshots ?? {})),
          details: new Map(Object.entries(value.details ?? {})),
          snapshotInFlight: new Map(),
          detailInFlight: new Map()
        };
        this.states.set(localKey, state);
      }
    })().catch(() => undefined);
    return this.hydration;
  }

  private async persist(): Promise<void> {
    if (!this.options.storage) return;
    const contexts: BoardCacheEnvelope["contexts"] = {};
    for (const [localKey, state] of this.states) {
      const snapshots: Record<string, CacheEntry<ProjectContextSnapshot>> = {};
      for (const [id, entry] of state.snapshots) snapshots[id] = entry;
      const details: Record<string, CacheEntry<ProjectContextSnapshot>> = {};
      for (const [id, entry] of state.details) details[id] = entry;
      contexts[localKey] = { sectionId: state.sectionId, discovery: state.discovery, snapshots, details };
    }
    await this.options.storage.set({ [PROJECT_CONTEXT_BOARD_CACHE_KEY]: { schemaVersion: 2, contexts } satisfies BoardCacheEnvelope });
  }
}
