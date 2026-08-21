import { describe, expect, it } from "vitest";
import { TodoistApi } from "../src/core/api.js";
import type { TodoistProjectContextRootDiscovery } from "../src/core/model.js";

describe("Todoist read-only API adapter", () => {
  it("uses GET-only bounded section and project reads", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const pages: Record<string, unknown> = {
      "section-1": { results: [taskPayload("root", "* 🗂️ Root", null, "Project context v1:\nProject Goal: Goal"), taskPayload("loose", "Loose", null, "ordinary")], next_cursor: null },
      root: taskPayload("root", "* 🗂️ Root", null, "Project context v1:\nProject Goal: Goal"),
      active: { results: [taskPayload("active", "Active", "root", "Project context v1:\nWorkstream: delivery\nSummary: Active")], next_cursor: null },
      completed: { items: [taskPayload("done", "Done", "root", "Project context v1:\nWorkstream: delivery\nSummary: Done", "2026-08-20T00:00:00.000Z")], next_cursor: null }
    };
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = String(init?.method ?? "GET");
      requests.push({ url: url.toString(), method });
      expect(method).toBe("GET");
      if (url.pathname.endsWith("/tasks") && url.searchParams.get("section_id")) return response(pages["section-1"]);
      if (url.pathname.endsWith("/tasks/root")) return response(pages.root);
      if (url.pathname.endsWith("/tasks") && url.searchParams.get("parent_id")) return response(pages.active);
      if (url.pathname.endsWith("/tasks/completed/by_completion_date")) return response(pages.completed);
      return new Response("not found", { status: 404 });
    };
    const api = new TodoistApi({ getAccessToken: async () => "access-fixture" }, fetcher);
    const roots: TodoistProjectContextRootDiscovery = await api.readProjectContextRoots("section-1");
    expect(roots.roots.map((root) => root.id)).toEqual(["root"]);
    const source = await api.readProjectContext("root", new Date("2026-08-21T00:00:00.000Z"));
    expect(source.activeTasks.map((task) => task.id)).toEqual(["active"]);
    expect(source.completedTasks.map((task) => task.id)).toEqual(["done"]);
    expect(requests.every((request) => request.method === "GET")).toBe(true);
    expect(requests.every((request) => new URL(request.url).origin === "https://api.todoist.com")).toBe(true);
    expect(requests.some((request) => request.url.includes("limit=50"))).toBe(true);
    expect(requests.some((request) => request.url.includes("parent_id=root"))).toBe(true);
  });

  it("invokes an injected receiver-sensitive fetcher with the global receiver", async () => {
    let receiver: unknown;
    const fetcher = function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
      receiver = this;
      if (this !== globalThis) return Promise.reject(new Error("wrong fetch receiver"));
      return Promise.resolve(response({ results: [], next_cursor: null }));
    } as typeof fetch;
    const api = new TodoistApi({ getAccessToken: async () => "access-fixture" }, fetcher);

    await expect(api.readProjectContextRoots("section-1")).resolves.toMatchObject({ roots: [] });
    expect(receiver).toBe(globalThis);
  });
});

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function taskPayload(id: string, content: string, parentId: string | null, description: string, completedAt: string | null = null): Record<string, unknown> {
  return { id, content, description, labels: [], priority: 2, project_id: "project", section_id: "section", parent_id: parentId, child_order: 1, completed_at: completedAt, is_deleted: false };
}
