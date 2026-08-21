import { describe, expect, it } from "vitest";
import { buildProjectContextSnapshot, isProjectDashboardRoot } from "../src/core/projection.js";
import { parseProjectMetadata, parseTaskMetadata } from "../src/core/metadata.js";
import { fixtureSource, task } from "./fixtures.js";

describe("Project context v1 projection", () => {
  it("parses bounded root and task metadata while ignoring unknown versions", () => {
    expect(parseProjectMetadata("before\nProject context v1:\nProject Goal: Explainable work\nWorkstream registry:\n- strategy | Strategy\n- delivery | Delivery\n\nother")).toEqual({
      goal: "Explainable work",
      workstreams: [{ id: "strategy", label: "Strategy" }, { id: "delivery", label: "Delivery" }]
    });
    expect(parseTaskMetadata("Project context v1:\nWorkstream: strategy\nSummary: Bounded summary\nContext Predecessors: done, done, bad id!, next\nCheckpoint: Checkpoint")).toEqual({
      workstreamId: "strategy",
      summary: "Bounded summary",
      predecessorIds: ["done", "next"],
      checkpoint: "Checkpoint"
    });
    expect(parseTaskMetadata("Project context v2:\nWorkstream: future")).toEqual({
      workstreamId: null,
      summary: null,
      predecessorIds: [],
      checkpoint: null
    });
  });

  it("keeps lifecycle, salience, lineage, and source immutability explicit", () => {
    const source = fixtureSource();
    const before = structuredClone(source);
    const snapshot = buildProjectContextSnapshot(source);
    expect(source).toEqual(before);
    expect(snapshot.lanes.flatMap((lane) => lane.nodes.map(({ id, status }) => [id, status]))).toEqual([
      ["done", "done"], ["now", "now"], ["later", "later"], ["blocked", "blocked"], ["watch", "watching"]
    ]);
    expect(snapshot.lanes.flatMap((lane) => lane.nodes).find((node) => node.id === "now")?.predecessorIds).toEqual(["done"]);
    expect(snapshot.coverage).toMatchObject({ visibleTasks: 5, suppressedTasks: 3 });
    expect(JSON.stringify(snapshot)).not.toContain("dependency");
    expect(JSON.stringify(snapshot)).not.toContain("maintenance evidence");
  });

  it("filters dashboard roots to top-level metadata or convention roots", () => {
    expect(isProjectDashboardRoot(task("meta", "Context", [], "Project context v1:\nProject Goal: Goal", null))).toBe(true);
    expect(isProjectDashboardRoot(task("nested", "Context", [], "Project context v1:", "parent"))).toBe(false);
    expect(isProjectDashboardRoot(task("convention", "* 🗂️ Convention", [], "ordinary", null))).toBe(true);
    expect(isProjectDashboardRoot(task("loose", "Idea", [], "ordinary", null))).toBe(false);
  });
});
