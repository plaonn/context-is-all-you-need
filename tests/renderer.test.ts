import { describe, expect, it } from "vitest";
import { buildProjectContextSnapshot } from "../src/core/projection.js";
import { renderBoard, renderContextSettings, renderSnapshot } from "../src/core/renderer.js";
import type { ProjectContextBoardProjection, ProjectContextContext, ProjectContextFreshness } from "../src/core/model.js";
import { fixtureSource, objectiveFixtureSource } from "./fixtures.js";

describe("Context matrix UI projection", () => {
  it("escapes source text and keeps canonical links plus presentation-only lineage", () => {
    const source = fixtureSource();
    source.root.content = "<private title>";
    const html = renderSnapshot(buildProjectContextSnapshot(source));
    expect(html).toContain("&lt;private title&gt;");
    expect(html).not.toContain("<private title>");
    expect(html).toContain("https://app.todoist.com/app/task/now");
    expect(html).toContain("Context Predecessors only");
    expect(html).not.toContain("create");
    expect(html).not.toContain("complete");
  });

  it("renders all selected-Context projects as compact horizontal graph lanes", () => {
    const first = fixtureSource();
    first.root = { ...first.root, id: "root-a", content: "* 🗂️ Project Atlas" };
    first.activeTasks = first.activeTasks.map((candidate) => candidate.id === "blocked"
      ? {
          ...candidate,
          description: `Project context v1:
Workstream: delivery
Summary: Keep the adapter boundary
Blocked on: Receiver contract
Why worker cannot decide: Receiver authority is missing
Decision owner: ChatGPT
Recommended safe/default path: Preserve the read-only adapter
Safe state preserved: No writes attempted
Independent work completed: Local projection checks
Resume condition: A durable decision is published
Evidence/provenance: Synthetic renderer fixture`
        }
      : candidate);
    const second = fixtureSource();
    second.root = { ...second.root, id: "root-b", content: "* 🗂️ Project Beacon" };
    const freshness: ProjectContextFreshness = {
      state: "fresh",
      updatedAt: "2026-08-21T00:00:00.000Z",
      ageMs: 0,
      refreshing: false,
      error: null
    };
    const context: ProjectContextContext = { localKey: "work", label: "Work", sectionId: "section-work" };
    const board: ProjectContextBoardProjection = {
      schemaVersion: 1,
      context,
      projects: [first, second].map((source) => ({
        root: { id: source.root.id, title: source.root.content, url: `https://app.todoist.com/app/task/${source.root.id}`, goal: "Recover direction", goalStatus: "configured" },
        snapshot: buildProjectContextSnapshot(source, "compact"),
        detail: null,
        freshness,
        detailFreshness: null,
        error: null
      })),
      discoveryCoverage: { sectionId: "section-work", sectionPagesFetched: 1, sectionTasksRead: 2, rootTasksRead: 2, sectionTruncated: false },
      freshness
    };

    const html = renderBoard(board, [context, { localKey: "personal", label: "Personal", sectionId: "section-personal" }]);

    expect(html).toContain('id="context-select"');
    expect(html).toContain("Project Atlas");
    expect(html).toContain("Project Beacon");
    expect(html).toContain("context-graph-plane");
    expect(html).toContain('data-layout-model="unified-context-graph-plane"');
    expect(html).toContain("graph-plane-now-rule");
    expect(html).toContain('data-shared-axis="now"');
    expect(html).toContain("graph-lane-canvas");
    expect(html).toContain("Load history & details");
    expect(html).toContain("Explicit lineage");
    expect(html).toContain("lineage-edge");
    expect(html).toContain("graph-edge-layer");
    expect(html).toContain("graph-edge-path");
    expect(html).toContain('data-lineage-source="Context Predecessors"');
    expect(html).toContain("Material attention");
    expect(html).toContain("Where:");
    expect(html).toContain("Decision owner:");
    expect(html).toContain("Next:");
    expect(html).toContain("presentation-only");
    expect(html).not.toContain("project-columns");
    expect(html).not.toContain("project-graph-band");
    expect(html).not.toContain("PROJECT COLUMN");
    expect(html).not.toContain("Safe state preserved:");
    expect(html).not.toContain('id="project-select"');
    expect(html).not.toContain("Bounded deep detail");

    const expandedBoard = {
      ...board,
      projects: board.projects.map((project, index) => index === 0
        ? { ...project, detail: buildProjectContextSnapshot(first, "deep"), detailFreshness: freshness }
        : project)
    };
    const expandedHtml = renderBoard(expandedBoard, [context], new Set(["root-a"]));
    expect(expandedHtml).toContain("Bounded deep detail");
    expect(expandedHtml).toContain("recent completed tasks read");
    expect(expandedHtml).toContain("Why worker cannot decide:");
    expect(expandedHtml).toContain("Safe state preserved:");
    expect(expandedHtml).toContain("Independent work completed:");
    expect(expandedHtml).toContain("Resume condition:");
  });

  it("renders objective hulls and explicit branch/merge lineage inside one graph plane", () => {
    const source = objectiveFixtureSource();
    const freshness: ProjectContextFreshness = {
      state: "fresh",
      updatedAt: "2026-08-22T00:00:00.000Z",
      ageMs: 0,
      refreshing: false,
      error: null
    };
    const context: ProjectContextContext = { localKey: "work", label: "Work", sectionId: "section-work" };
    const board: ProjectContextBoardProjection = {
      schemaVersion: 1,
      context,
      projects: [{
        root: { id: source.root.id, title: source.root.content, url: `https://app.todoist.com/app/task/${source.root.id}`, goal: "Recover the current direction", goalStatus: "configured" },
        snapshot: buildProjectContextSnapshot(source, "compact"),
        detail: null,
        freshness,
        detailFreshness: null,
        error: null
      }],
      discoveryCoverage: { sectionId: "section-work", sectionPagesFetched: 1, sectionTasksRead: 1, rootTasksRead: 1, sectionTruncated: false },
      freshness
    };

    const html = renderBoard(board, [context]);

    expect(html).toContain('data-objective-id="focus"');
    expect(html).toContain("Close the current boundary");
    expect(html).toContain('data-objective-id="recovery"');
    expect(html).toContain("lineage-edge-branch");
    expect(html).toContain("lineage-edge-merge");
    expect(html).toContain("graph-edge-branch");
    expect(html).toContain("graph-edge-merge");
    expect(html).toMatch(/data-node-id="root-matrix-parent"[^>]*data-graph-row="0"[^>]*data-graph-x="[0-9.]+"/);
    expect(html).toMatch(/data-node-id="root-matrix-branch-a"[^>]*data-graph-row="0"[^>]*data-graph-x="[0-9.]+"/);
    expect(html).toMatch(/data-node-id="root-matrix-branch-b"[^>]*data-graph-row="0"[^>]*data-graph-x="[0-9.]+"/);
    expect(html).toMatch(/data-objective-id="focus"[\s\S]*data-node-id="root-matrix-parent"/);
    expect(html).toMatch(/data-objective-id="focus"[\s\S]*data-node-id="root-matrix-branch-a"/);
    expect(html).toMatch(/data-objective-id="focus"[\s\S]*data-node-id="root-matrix-branch-b"/);
    expect(html).toContain("NOW");
    expect(html).toContain('data-shared-axis="now"');
    expect(html).toContain('data-edge-from="root-matrix-history" data-edge-to="root-matrix-parent"');
    expect(html).toContain('data-objective-state="ungrouped"');
    expect(html).not.toContain("No salient nodes in this bounded band.");
    expect((html.match(/class="graph-edge-path/g) ?? []).length).toBe(5);
    expect(html).not.toContain('class="project-objectives"');
    expect(html).not.toContain("project-grid");
    expect(html).not.toContain("objective-complete");
  });

  it("keeps dense, sparse, and partial projects on one bounded plane", () => {
    const freshness: ProjectContextFreshness = {
      state: "fresh",
      updatedAt: "2026-08-22T00:00:00.000Z",
      ageMs: 0,
      refreshing: false,
      error: null
    };
    const context: ProjectContextContext = { localKey: "work", label: "Work", sectionId: "section-work" };
    const dense = fixtureSource();
    dense.root = { ...dense.root, id: "root-dense", content: "* 🗂️ Dense" };
    const objective = objectiveFixtureSource("root-objective");
    const idle = fixtureSource();
    idle.root = { ...idle.root, id: "root-idle", content: "* 🗂️ Idle" };
    idle.activeTasks = [];
    idle.completedTasks = [];
    const projectFrom = (source: ReturnType<typeof fixtureSource>, snapshot = buildProjectContextSnapshot(source, "compact")) => ({
      root: { id: source.root.id, title: source.root.content, url: `https://app.todoist.com/app/task/${source.root.id}`, goal: snapshot.goal, goalStatus: snapshot.goalStatus },
      snapshot,
      detail: null,
      freshness,
      detailFreshness: null,
      error: null
    });
    const partialRoot = { id: "root-partial", title: "* 🗂️ Partial", url: "https://app.todoist.com/app/task/root-partial", goal: null, goalStatus: "unconfigured" as const };
    const board: ProjectContextBoardProjection = {
      schemaVersion: 1,
      context,
      projects: [
        projectFrom(dense),
        projectFrom(objective),
        projectFrom(idle),
        { root: partialRoot, snapshot: null, detail: null, freshness, detailFreshness: null, error: "provider_unavailable" }
      ],
      discoveryCoverage: { sectionId: "section-work", sectionPagesFetched: 1, sectionTasksRead: 4, rootTasksRead: 4, sectionTruncated: false },
      freshness
    };

    const html = renderBoard(board, [context]);

    expect(html).toContain('data-layout-model="unified-context-graph-plane"');
    expect(html).toContain('data-project-count="4"');
    expect((html.match(/class="graph-plane-now-rule"/g) ?? []).length).toBe(1);
    expect((html.match(/class="graph-lane-canvas/g) ?? []).length).toBe(4);
    expect(html).toContain('data-idle-marker="true"');
    expect(html).toContain("Project read unavailable");
    expect(html).toContain('data-objective-id="focus"');
    expect(html).toContain('data-objective-id="recovery"');
    expect(html).toContain('data-edge-from="root-objective-history" data-edge-to="root-objective-parent"');
    expect(html).toContain("graph-edge-branch");
    expect(html).toContain("graph-edge-merge");
    expect(html).not.toContain("No explicit branch or merge edge in the bounded source window.");
    expect(html).not.toContain("No salient nodes in this bounded band.");
  });

  it("keeps Context mappings local and exposes edit/remove controls", () => {
    const html = renderContextSettings([
      { localKey: "work", label: "Work", sectionId: "section-work" },
      { localKey: "personal", label: "Personal", sectionId: "section-personal" }
    ], "work");

    expect(html).toContain("Work");
    expect(html).toContain("Personal");
    expect(html).toContain('data-context-edit="work"');
    expect(html).toContain('data-context-remove="personal"');
    expect(html).not.toContain("create");
  });
});
