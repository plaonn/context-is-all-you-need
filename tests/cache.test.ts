import { describe, expect, it } from "vitest";
import { ProjectContextBoardCache, ProjectContextCache } from "../src/core/cache.js";
import { MemoryStorage } from "../src/core/storage.js";
import type { ProjectContextContext, ProjectContextReader, TodoistProjectContextRootDiscovery, TodoistProjectContextSource } from "../src/core/model.js";
import { fixtureSource, task } from "./fixtures.js";

function roots(): TodoistProjectContextRootDiscovery {
  return {
    roots: [task("root", "* 🗂️ Project Atlas", [], "Project context v1:\nProject Goal: Recover direction", null)],
    coverage: { sectionId: "section", sectionPagesFetched: 1, sectionTasksRead: 1, rootTasksRead: 1, sectionTruncated: false }
  };
}

describe("browser-local project context cache", () => {
  it("keeps discovery and selected snapshots separate and single-flight", async () => {
    let discoveryReads = 0;
    let snapshotReads = 0;
    const reader: ProjectContextReader = {
      readProjectContextRoots: async () => { discoveryReads += 1; return roots(); },
      readProjectContext: async () => { snapshotReads += 1; return fixtureSource(); }
    };
    const cache = new ProjectContextCache(reader, "section", { storage: new MemoryStorage(), freshTtlMs: 1000, staleTtlMs: 5000 });
    const [one, two] = await Promise.all([cache.readSelection(), cache.readSelection("root")]);
    expect(one.snapshot.id).toBe("root");
    expect(two.freshness.discovery.state).toBe("fresh");
    expect(discoveryReads).toBe(1);
    expect(snapshotReads).toBe(1);
  });

  it("returns stale data while running one SWR refresh and surfaces provider error", async () => {
    let now = 0;
    let fail = false;
    let discoveryReads = 0;
    let snapshotReads = 0;
    const reader: ProjectContextReader = {
      readProjectContextRoots: async () => { discoveryReads += 1; if (fail) throw new Error("provider payload"); return roots(); },
      readProjectContext: async () => { snapshotReads += 1; if (fail) throw new Error("provider payload"); return fixtureSource(); }
    };
    const cache = new ProjectContextCache(reader, "section", { now: () => now, freshTtlMs: 1000, staleTtlMs: 5000 });
    await cache.readSelection();
    now = 2_000;
    fail = true;
    const stale = await cache.readSelection();
    expect(stale.freshness.discovery.state).toBe("stale");
    expect(stale.freshness.snapshot.state).toBe("stale");
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    const failed = await cache.readSelection();
    expect(failed.freshness.discovery.error).toBe("provider_unavailable");
    expect(failed.freshness.snapshot.error).toBe("provider_unavailable");
    expect(discoveryReads).toBeGreaterThanOrEqual(2);
    expect(snapshotReads).toBeGreaterThanOrEqual(2);
    now = 7_000;
    await expect(cache.readSelection()).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("hydrates only projected fields from browser-local session storage", async () => {
    const storage = new MemoryStorage();
    const reader: ProjectContextReader = { readProjectContextRoots: async () => roots(), readProjectContext: async () => fixtureSource() };
    const first = new ProjectContextCache(reader, "section", { storage });
    await first.readSelection();
    const second = new ProjectContextCache({
      readProjectContextRoots: async () => { throw new Error("should be cached"); },
      readProjectContext: async () => { throw new Error("should be cached"); }
    }, "section", { storage });
    await expect(second.readSelection()).resolves.toMatchObject({ snapshot: { id: "root" } });
  });

  it("reads compact project cards in bounded parallelism, isolates failures, and defers deep detail", async () => {
    const rootIds = ["root-1", "root-2", "root-3", "root-4", "root-5"];
    let compactReads = 0;
    let detailReads = 0;
    let activeReads = 0;
    let maxActiveReads = 0;
    const reader: ProjectContextReader = {
      readProjectContextRoots: async () => ({
        roots: rootIds.map((id) => task(id, `* 🗂️ ${id}`, [], "Project context v1:\nProject Goal: Goal", null)),
        coverage: { sectionId: "section-board", sectionPagesFetched: 1, sectionTasksRead: rootIds.length, rootTasksRead: rootIds.length, sectionTruncated: false }
      }),
      readProjectContextCompact: async (rootTaskId) => {
        compactReads += 1;
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await Promise.resolve();
        activeReads -= 1;
        if (rootTaskId === "root-3") throw new Error("synthetic provider failure");
        return sourceFor(rootTaskId);
      },
      readProjectContext: async (rootTaskId) => {
        detailReads += 1;
        return sourceFor(rootTaskId);
      }
    };
    const context: ProjectContextContext = { localKey: "fixture", label: "Fixture Context", sectionId: "section-board" };
    const cache = new ProjectContextBoardCache(reader, { maxProjectConcurrency: 2 });

    const board = await cache.readBoard(context);

    expect(board.projects).toHaveLength(rootIds.length);
    expect(compactReads).toBe(rootIds.length);
    expect(maxActiveReads).toBeLessThanOrEqual(2);
    expect(board.projects.find((project) => project.root.id === "root-3")).toMatchObject({ snapshot: null, error: "provider_unavailable" });
    expect(detailReads).toBe(0);

    await cache.readDetail(context, "root-2");
    expect(detailReads).toBe(1);
    const afterDetail = await cache.readBoard(context);
    expect(afterDetail.projects.find((project) => project.root.id === "root-2")?.detail?.detailLevel).toBe("deep");
  });

  it("hydrates per-context projected board data without reopening the provider", async () => {
    const storage = new MemoryStorage();
    const context: ProjectContextContext = { localKey: "fixture", label: "Fixture Context", sectionId: "section-board" };
    const reader: ProjectContextReader = {
      readProjectContextRoots: async () => ({
        roots: [task("root", "* 🗂️ Project Atlas", [], "Project context v1:\nProject Goal: Recover direction", null)],
        coverage: { sectionId: "section-board", sectionPagesFetched: 1, sectionTasksRead: 1, rootTasksRead: 1, sectionTruncated: false }
      }),
      readProjectContextCompact: async () => fixtureSource(),
      readProjectContext: async () => fixtureSource()
    };
    await new ProjectContextBoardCache(reader, { storage }).readBoard(context);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const cached = new ProjectContextBoardCache({
      readProjectContextRoots: async () => { throw new Error("should be cached"); },
      readProjectContextCompact: async () => { throw new Error("should be cached"); },
      readProjectContext: async () => { throw new Error("should be cached"); }
    }, { storage });
    await expect(cached.readBoard(context)).resolves.toMatchObject({
      context,
      projects: [{ root: { id: "root" }, snapshot: { id: "root", detailLevel: "compact" } }]
    });
  });

  it("keeps Context section roots isolated while reusing warm selected-context data", async () => {
    const discoverySections: string[] = [];
    let compactReads = 0;
    const reader: ProjectContextReader = {
      readProjectContextRoots: async (sectionId) => {
        discoverySections.push(sectionId);
        const rootId = sectionId === "section-work" ? "root-work" : "root-personal";
        return {
          roots: [task(rootId, `* 🗂️ ${rootId}`, [], "Project context v1:\nProject Goal: Goal", null)],
          coverage: { sectionId, sectionPagesFetched: 1, sectionTasksRead: 1, rootTasksRead: 1, sectionTruncated: false }
        };
      },
      readProjectContextCompact: async (rootTaskId) => {
        compactReads += 1;
        return sourceFor(rootTaskId);
      },
      readProjectContext: async (rootTaskId) => sourceFor(rootTaskId)
    };
    const cache = new ProjectContextBoardCache(reader);
    const work = { localKey: "work", label: "Work", sectionId: "section-work" };
    const personal = { localKey: "personal", label: "Personal", sectionId: "section-personal" };

    await expect(cache.readBoard(work)).resolves.toMatchObject({ projects: [{ root: { id: "root-work" } }] });
    await expect(cache.readBoard(personal)).resolves.toMatchObject({ projects: [{ root: { id: "root-personal" } }] });
    await expect(cache.readBoard(work)).resolves.toMatchObject({ projects: [{ root: { id: "root-work" } }] });

    expect(discoverySections).toEqual(["section-work", "section-personal"]);
    expect(compactReads).toBe(2);
  });
});

function sourceFor(rootId: string): TodoistProjectContextSource {
  const source = fixtureSource();
  source.root = { ...source.root, id: rootId, content: `* 🗂️ ${rootId}` };
  source.activeTasks = source.activeTasks.map((child, index) => ({ ...child, id: `${rootId}-task-${index}`, parentId: rootId }));
  source.completedTasks = source.completedTasks.map((child, index) => ({ ...child, id: `${rootId}-done-${index}`, parentId: rootId }));
  return source;
}
