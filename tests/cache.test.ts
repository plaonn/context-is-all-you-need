import { describe, expect, it } from "vitest";
import { ProjectContextCache } from "../src/core/cache.js";
import { MemoryStorage } from "../src/core/storage.js";
import type { ProjectContextReader, TodoistProjectContextRootDiscovery } from "../src/core/model.js";
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
});
