import { readBoundedPages } from "./pagination.js";
import { isProjectDashboardRoot } from "./projection.js";
import { createFetchTransport, type Fetcher, type FetchTransport } from "./transport.js";
import type {
  ProjectContextReader,
  TodoistProjectContextRootDiscovery,
  TodoistProjectContextSource,
  TodoistProjectContextTask
} from "./model.js";

const TODOIST_API_BASE = "https://api.todoist.com/api/v1/";
const PAGE_LIMIT = 50;
const SECTION_MAX_PAGES = 4;
const ACTIVE_MAX_PAGES = 4;
const COMPACT_ACTIVE_MAX_PAGES = 2;
const COMPACT_COMPLETED_MAX_PAGES = 1;
const COMPLETED_MAX_PAGES = 3;
const COMPLETED_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1_000;

export type AccessTokenProvider = {
  getAccessToken(forceRefresh?: boolean): Promise<string>;
};

export class TodoistApiError extends Error {
  constructor(public readonly code: "unauthorized" | "forbidden" | "rate_limited" | "provider_error" | "invalid_response", public readonly status: number | null, message: string) {
    super(message);
  }
}

export class TodoistApi implements ProjectContextReader {
  private readonly transport: FetchTransport;

  constructor(
    private readonly tokenProvider: AccessTokenProvider,
    fetcher: Fetcher = globalThis.fetch,
    private readonly apiBase = TODOIST_API_BASE
  ) {
    this.transport = createFetchTransport(fetcher);
  }

  async readProjectContextRoots(sectionId: string): Promise<TodoistProjectContextRootDiscovery> {
    const page = await readBoundedPages(
      (cursor) => this.readPage("tasks", { section_id: sectionId }, "results", cursor),
      SECTION_MAX_PAGES
    );
    const roots = page.items.filter(isProjectDashboardRoot);
    return {
      roots,
      coverage: {
        sectionId,
        sectionPagesFetched: page.pagesFetched,
        sectionTasksRead: page.items.length,
        rootTasksRead: roots.length,
        sectionTruncated: page.truncated
      }
    };
  }

  async readProjectContextCompact(rootTaskId: string, now = new Date()): Promise<TodoistProjectContextSource> {
    const root = await this.readTask(rootTaskId);
    const completedUntil = now.toISOString();
    const completedSince = new Date(now.valueOf() - COMPLETED_LOOKBACK_MS).toISOString();
    const active = await readBoundedPages(
      (cursor) => this.readPage("tasks", { parent_id: rootTaskId }, "results", cursor),
      COMPACT_ACTIVE_MAX_PAGES
    );
    const completed = await readBoundedPages(
      (cursor) => this.readPage("tasks/completed/by_completion_date", {
        parent_id: rootTaskId,
        since: completedSince,
        until: completedUntil
      }, "items", cursor),
      COMPACT_COMPLETED_MAX_PAGES
    );
    return {
      root,
      activeTasks: active.items.filter((task) => task.parentId === rootTaskId),
      completedTasks: completed.items.filter((task) => task.parentId === rootTaskId && !task.isDeleted),
      coverage: {
        activePagesFetched: active.pagesFetched,
        completedPagesFetched: completed.pagesFetched,
        activeTruncated: active.truncated,
        completedTruncated: completed.truncated,
        completedSince,
        completedUntil
      }
    };
  }

  async readProjectContext(rootTaskId: string, now = new Date()): Promise<TodoistProjectContextSource> {
    const root = await this.readTask(rootTaskId);
    const completedUntil = now.toISOString();
    const completedSince = new Date(now.valueOf() - COMPLETED_LOOKBACK_MS).toISOString();
    const active = await readBoundedPages(
      (cursor) => this.readPage("tasks", { parent_id: rootTaskId }, "results", cursor),
      ACTIVE_MAX_PAGES
    );
    const completed = await readBoundedPages(
      (cursor) => this.readPage("tasks/completed/by_completion_date", {
        parent_id: rootTaskId,
        since: completedSince,
        until: completedUntil
      }, "items", cursor),
      COMPLETED_MAX_PAGES
    );
    return {
      root,
      activeTasks: active.items.filter((task) => task.parentId === rootTaskId),
      completedTasks: completed.items.filter((task) => task.parentId === rootTaskId && !task.isDeleted),
      coverage: {
        activePagesFetched: active.pagesFetched,
        completedPagesFetched: completed.pagesFetched,
        activeTruncated: active.truncated,
        completedTruncated: completed.truncated,
        completedSince,
        completedUntil
      }
    };
  }

  private async readTask(id: string): Promise<TodoistProjectContextTask> {
    const body = await this.readJson(`tasks/${encodeURIComponent(id)}`);
    return parseTask(body);
  }

  private async readPage(
    path: string,
    parameters: Record<string, string>,
    itemsKey: "results" | "items",
    cursor: string | null
  ): Promise<{ items: TodoistProjectContextTask[]; nextCursor: string | null }> {
    const query = { ...parameters, limit: String(PAGE_LIMIT), ...(cursor ? { cursor } : {}) };
    const body = await this.readJson(path, query);
    if (!isRecord(body) || !Array.isArray(body[itemsKey])) {
      throw new TodoistApiError("invalid_response", null, "Todoist returned an invalid project-context page");
    }
    const items = body[itemsKey].map(parseTask);
    const nextCursor = typeof body.next_cursor === "string" && body.next_cursor.length > 0
      ? body.next_cursor
      : null;
    return { items, nextCursor };
  }

  private async readJson(path: string, parameters: Record<string, string> = {}): Promise<unknown> {
    let forceRefresh = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.tokenProvider.getAccessToken(forceRefresh);
      const url = new URL(path, this.apiBase);
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      let response: Response;
      try {
        response = await this.transport.request(url, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
        });
      } catch {
        throw new TodoistApiError("provider_error", null, "Todoist request failed");
      }
      if (response.status === 401 && attempt === 0) {
        forceRefresh = true;
        continue;
      }
      if (!response.ok) throw responseError(response.status);
      try {
        return await response.json();
      } catch {
        throw new TodoistApiError("invalid_response", response.status, "Todoist returned invalid JSON");
      }
    }
    throw new TodoistApiError("unauthorized", 401, "Todoist authorization expired");
  }
}

function responseError(status: number): TodoistApiError {
  if (status === 401) return new TodoistApiError("unauthorized", status, "Todoist authorization expired");
  if (status === 403) return new TodoistApiError("forbidden", status, "Todoist denied read access");
  if (status === 429) return new TodoistApiError("rate_limited", status, "Todoist rate limit reached");
  return new TodoistApiError("provider_error", status, "Todoist request failed");
}

function parseTask(value: unknown): TodoistProjectContextTask {
  if (!isRecord(value)) throw new TodoistApiError("invalid_response", null, "Todoist task is not an object");
  const id = stringId(value.id);
  if (!id || typeof value.content !== "string") {
    throw new TodoistApiError("invalid_response", null, "Todoist task is missing a stable id or title");
  }
  const priority = value.priority === 1 || value.priority === 2 || value.priority === 3 || value.priority === 4
    ? value.priority
    : 4;
  return {
    id,
    content: value.content,
    description: typeof value.description === "string" ? value.description : "",
    labels: Array.isArray(value.labels) ? value.labels.filter((label): label is string => typeof label === "string") : [],
    priority,
    projectId: stringId(value.project_id),
    sectionId: stringId(value.section_id),
    parentId: stringId(value.parent_id),
    childOrder: typeof value.child_order === "number" && Number.isFinite(value.child_order) ? value.child_order : 0,
    completedAt: typeof value.completed_at === "string" ? value.completed_at : null,
    isDeleted: value.is_deleted === true
  };
}

function stringId(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
