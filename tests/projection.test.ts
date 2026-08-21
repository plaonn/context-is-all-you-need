import { describe, expect, it } from "vitest";
import { buildProjectContextSnapshot, isProjectDashboardRoot } from "../src/core/projection.js";
import { parseProjectMetadata, parseTaskAttentionMetadata, parseTaskMetadata } from "../src/core/metadata.js";
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
    expect(parseTaskAttentionMetadata(`Project context v1:
Blocked on: Synthetic provider boundary
Why worker cannot decide: Receiver authority is not present
Decision owner: ChatGPT
Recommended safe/default path: Preserve read-only state
Alternatives: Wait for owner confirmation
Safe state preserved: No writes attempted
Independent work completed: Local adapter checks
Resume condition: Owner decision is published
Evidence/provenance: Synthetic fixture`)).toEqual({
      blockedOn: "Synthetic provider boundary",
      whyWorkerCannotDecide: "Receiver authority is not present",
      decisionOwner: "ChatGPT",
      recommendation: "Preserve read-only state",
      alternatives: "Wait for owner confirmation",
      safeState: "No writes attempted",
      independentWork: "Local adapter checks",
      resumeCondition: "Owner decision is published",
      evidence: "Synthetic fixture",
      disposition: null
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

  it("surfaces bounded blocked and decision attention without inferring authority", () => {
    const source = fixtureSource();
    source.activeTasks = source.activeTasks.map((candidate) => candidate.id === "blocked"
      ? {
          ...candidate,
          description: `Project context v1:
Workstream: delivery
Summary: Keep the adapter boundary
Blocked on: Receiver contract
Why worker cannot decide: Receiver authority is missing
Decision owner: ChatGPT
Recommended safe/default path: Preserve the read-only adapter
Safe state preserved: No Todoist writes attempted
Independent work completed: Local projection checks
Resume condition: A durable decision is published
Evidence/provenance: Synthetic blocked packet`
        }
      : candidate);
    source.activeTasks.push(
      task("decision", "Clarify safe route", ["codex-candidate"], `Project context v1:
Workstream: strategy
Summary: Keep a material decision visible
Why worker cannot decide: Two routes have distinct authority effects
Decision owner: user
Recommended safe/default path: Keep the current read-only route
Resume condition: User decision is published`),
      task("unknown-owner", "Unknown owner packet", ["codex-now"], `Project context v1:
Workstream: strategy
Summary: Missing owner must remain unknown
Why worker cannot decide: Synthetic authority is unspecified`),
      task("resolved", "Resolved exception residue", ["codex-blocked", "resolved"], `Project context v1:
Workstream: delivery
Summary: Resolved residue
Decision owner: ChatGPT
Disposition: resolved`),
      task("obsolete", "Obsolete exception residue", ["codex-blocked"], `Project context v1:
Workstream: delivery
Summary: Obsolete residue
Decision owner: user
Disposition: obsolete`),
      task("incident", "incident evidence residue", ["codex-blocked"], `Project context v1:
Workstream: delivery
Summary: Routine incident chatter without a bounded packet`)
    );

    const snapshot = buildProjectContextSnapshot(source);
    const nodes = snapshot.lanes.flatMap((lane) => lane.nodes);
    expect(nodes.find((node) => node.id === "blocked")?.attention).toMatchObject({
      kind: "blocked",
      salience: "high",
      blockedOn: "Receiver contract",
      decisionOwner: "ChatGPT",
      recommendation: "Preserve the read-only adapter",
      resumeCondition: "A durable decision is published"
    });
    expect(nodes.find((node) => node.id === "decision")?.attention).toMatchObject({
      kind: "decision",
      salience: "high",
      decisionOwner: "user"
    });
    expect(nodes.find((node) => node.id === "unknown-owner")?.attention).toMatchObject({
      kind: "decision",
      decisionOwner: null
    });
    expect(nodes.find((node) => node.id === "resolved")?.attention).toBeNull();
    expect(nodes.find((node) => node.id === "obsolete")?.attention).toBeNull();
    expect(nodes.find((node) => node.id === "incident")?.attention).toBeNull();
    expect(snapshot.attention).toMatchObject({
      nodeId: "blocked",
      kind: "blocked",
      salience: "high",
      attentionCount: 3,
      decisionOwner: "ChatGPT"
    });
  });

  it("keeps passive watching lower-salience and preserves safe missing-field degradation", () => {
    const source = fixtureSource();
    source.activeTasks = [source.activeTasks.find((candidate) => candidate.id === "watch")!];
    const snapshot = buildProjectContextSnapshot(source);
    const node = snapshot.lanes.flatMap((lane) => lane.nodes).find((candidate) => candidate.id === "watch");
    expect(node?.attention).toMatchObject({ kind: "watching", salience: "low", resumeCondition: "One safe cycle is available", decisionOwner: null });
    expect(snapshot.attention).toMatchObject({ kind: "watching", salience: "low", attentionCount: 1 });
  });
});
