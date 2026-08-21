export const PROJECT_CONTEXT_METADATA_VERSION = 1;

export type ProjectContextStatus = "now" | "later" | "blocked" | "watching" | "done";

export type TodoistProjectContextTask = {
  id: string;
  content: string;
  description: string;
  labels: string[];
  priority: 1 | 2 | 3 | 4;
  projectId: string | null;
  sectionId: string | null;
  parentId: string | null;
  childOrder: number;
  completedAt: string | null;
  isDeleted: boolean;
};

export type TodoistProjectContextCoverage = {
  activePagesFetched: number;
  completedPagesFetched: number;
  activeTruncated: boolean;
  completedTruncated: boolean;
  completedSince: string;
  completedUntil: string;
};

export type TodoistProjectContextDiscoveryCoverage = {
  sectionId: string;
  sectionPagesFetched: number;
  sectionTasksRead: number;
  rootTasksRead: number;
  sectionTruncated: boolean;
};

export type TodoistProjectContextRootDiscovery = {
  roots: TodoistProjectContextTask[];
  coverage: TodoistProjectContextDiscoveryCoverage;
};

export type TodoistProjectContextSource = {
  root: TodoistProjectContextTask;
  activeTasks: TodoistProjectContextTask[];
  completedTasks: TodoistProjectContextTask[];
  coverage: TodoistProjectContextCoverage;
};

export type ProjectContextNode = {
  id: string;
  title: string;
  url: string;
  workstreamId: string;
  summary: string;
  checkpoint: string | null;
  predecessorIds: string[];
  status: ProjectContextStatus;
  completedAt: string | null;
  blocker: string | null;
  resume: string | null;
};

export type ProjectContextGoalStatus = "configured" | "unconfigured";

export type ProjectContextRootSummary = {
  id: string;
  title: string;
  url: string;
  goal: string | null;
  goalStatus: ProjectContextGoalStatus;
};

export type ProjectContextLane = {
  id: string;
  label: string;
  nodes: ProjectContextNode[];
};

export type ProjectContextSnapshot = {
  schemaVersion: 1;
  id: string;
  title: string;
  url: string;
  goal: string | null;
  goalStatus: ProjectContextGoalStatus;
  lanes: ProjectContextLane[];
  nextCheckpoint: string | null;
  coverage: TodoistProjectContextCoverage & {
    activeTasksRead: number;
    completedTasksRead: number;
    visibleTasks: number;
    suppressedTasks: number;
  };
};

export type ProjectContextFreshnessState = "fresh" | "stale" | "expired";

export type ProjectContextFreshness = {
  state: ProjectContextFreshnessState;
  updatedAt: string;
  ageMs: number;
  refreshing: boolean;
  error: "provider_unavailable" | null;
};

export type ProjectContextRootDiscoveryProjection = {
  roots: ProjectContextRootSummary[];
  coverage: TodoistProjectContextDiscoveryCoverage;
  freshness: ProjectContextFreshness;
};

export type ProjectContextSelectionProjection = {
  roots: ProjectContextRootSummary[];
  discoveryCoverage: TodoistProjectContextDiscoveryCoverage;
  snapshot: ProjectContextSnapshot;
  freshness: {
    discovery: ProjectContextFreshness;
    snapshot: ProjectContextFreshness;
  };
};

export type ProjectContextReader = {
  readProjectContextRoots(sectionId: string): Promise<TodoistProjectContextRootDiscovery>;
  readProjectContext(rootTaskId: string, now?: Date): Promise<TodoistProjectContextSource>;
};

export type KeyValueStorage = {
  get<T>(key: string): Promise<T | undefined>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

export const OAUTH_CLIENT_REGISTRATION_VERSION = 1 as const;

export type OAuthClientRegistration = {
  clientId: string;
  redirectUri: string;
  registrationVersion: typeof OAUTH_CLIENT_REGISTRATION_VERSION;
};

export type OAuthConfig = {
  /** Dynamic Todoist public client ID, or the supported historical metadata URL form. */
  clientId: string;
  scope: "data:read";
  redirectPath: string;
  /** Redirect URI bound to the client registration at authorization time. */
  redirectUri: string;
};

export type OAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string;
};
