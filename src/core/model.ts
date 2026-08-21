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
  /** Optional bounded exception/decision projection; never an authority signal. */
  attention?: ProjectContextAttention | null;
};

export type ProjectContextAttentionKind = "blocked" | "decision" | "watching";
export type ProjectContextAttentionSalience = "high" | "low";

/**
 * Resume-critical fields copied from an existing bounded exception packet.
 * These values are presentation-only and do not grant approval or execution authority.
 */
export type ProjectContextAttention = {
  kind: ProjectContextAttentionKind;
  salience: ProjectContextAttentionSalience;
  blockedOn: string | null;
  whyWorkerCannotDecide: string | null;
  decisionOwner: string | null;
  recommendation: string | null;
  alternatives: string | null;
  safeState: string | null;
  independentWork: string | null;
  resumeCondition: string | null;
  evidence: string | null;
};

/** Compact card-level attention summary. Full fields remain behind expansion. */
export type ProjectContextAttentionSummary = {
  nodeId: string;
  title: string;
  url: string;
  kind: ProjectContextAttentionKind;
  salience: ProjectContextAttentionSalience;
  attentionCount: number;
  blockedOn: string | null;
  whyWorkerCannotDecide: string | null;
  decisionOwner: string | null;
  recommendation: string | null;
  resumeCondition: string | null;
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
  detailLevel?: "compact" | "deep";
  id: string;
  title: string;
  url: string;
  goal: string | null;
  goalStatus: ProjectContextGoalStatus;
  lanes: ProjectContextLane[];
  nextCheckpoint: string | null;
  attention?: ProjectContextAttentionSummary | null;
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
  /** Compact read used by the parallel board. Implementations may omit it while migrating. */
  readProjectContextCompact?(rootTaskId: string, now?: Date): Promise<TodoistProjectContextSource>;
  readProjectContext(rootTaskId: string, now?: Date): Promise<TodoistProjectContextSource>;
};

export type ProjectContextContext = {
  localKey: string;
  label: string;
  sectionId: string;
};

export type ProjectContextBoardProject = {
  root: ProjectContextRootSummary;
  snapshot: ProjectContextSnapshot | null;
  detail: ProjectContextSnapshot | null;
  freshness: ProjectContextFreshness;
  detailFreshness: ProjectContextFreshness | null;
  error: "provider_unavailable" | null;
};

export type ProjectContextBoardProjection = {
  schemaVersion: 1;
  context: ProjectContextContext;
  projects: ProjectContextBoardProject[];
  discoveryCoverage: TodoistProjectContextDiscoveryCoverage;
  freshness: ProjectContextFreshness;
};

export type KeyValueStorage = {
  get<T>(key: string): Promise<T | undefined>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

export const TODOIST_OAUTH_ISSUER = "https://todoist.com" as const;
export const TODOIST_OAUTH_REGISTRATION_ENDPOINT = "https://api.todoist.com/oauth/register" as const;
export const TODOIST_OAUTH_AUTHORIZATION_ENDPOINT = "https://app.todoist.com/oauth/authorize" as const;
export const TODOIST_OAUTH_TOKEN_ENDPOINT = "https://api.todoist.com/oauth/access_token" as const;
export const OAUTH_CLIENT_REGISTRATION_VERSION = 3 as const;

export type OAuthClientRegistration = {
  clientId: string;
  redirectUri: string;
  issuer: typeof TODOIST_OAUTH_ISSUER;
  registrationEndpoint: typeof TODOIST_OAUTH_REGISTRATION_ENDPOINT;
  authorizationEndpoint: typeof TODOIST_OAUTH_AUTHORIZATION_ENDPOINT;
  tokenEndpoint: typeof TODOIST_OAUTH_TOKEN_ENDPOINT;
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
