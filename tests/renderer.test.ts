import { describe, expect, it } from "vitest";
import { buildProjectContextSnapshot } from "../src/core/projection.js";
import { renderBoard, renderContextSettings, renderSnapshot } from "../src/core/renderer.js";
import type { ProjectContextBoardProjection, ProjectContextContext, ProjectContextFreshness } from "../src/core/model.js";
import { fixtureSource } from "./fixtures.js";

describe("line-and-box UI projection", () => {
  it("escapes source text and keeps canonical links plus presentation-only lineage", () => {
    const source = fixtureSource();
    source.root.content = "<private title>";
    const html = renderSnapshot(buildProjectContextSnapshot(source));
    expect(html).toContain("&lt;private title&gt;");
    expect(html).not.toContain("<private title>");
    expect(html).toContain("https://app.todoist.com/app/task/now");
    expect(html).toContain("Context predecessors");
    expect(html).not.toContain("create");
    expect(html).not.toContain("complete");
  });

  it("renders all selected-Context projects as compact connected workstream cards", () => {
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
    expect(html).toContain("map-connector");
    expect(html).toContain("Load history & details");
    expect(html).toContain("Presentation-only connected workstream map");
    expect(html).toContain("Material attention");
    expect(html).toContain("Where:");
    expect(html).toContain("Decision owner:");
    expect(html).toContain("Next:");
    expect(html).toContain("no approval or authority inferred");
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
