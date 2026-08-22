# ADR 0005: Shared-NOW project-column graph

Status: accepted for the 2026-08-22 Context matrix revision

## Context

The bounded multi-Context board made project roots visible together, but compact cards and Workstream lanes did not give a stable comparison axis across projects or a clear presentation for short-term Objectives and explicit branch/merge context. The source remains Todoist read-only, and the existing Project context v1 lifecycle, cache, attention, OAuth, and privacy boundaries must remain unchanged.

## Decision

Render the selected Context as a wide-screen matrix with this hierarchy: Context → horizontal Project columns → registered Objective regions → explicit Context Predecessor lineage around a shared semantic NOW band. Each Project column has bounded `before`, `now`, and `after` bands; the NOW band is the comparison axis, not a chronological coordinate. Narrow layouts transpose the columns vertically while preserving node and edge semantics.

Objective metadata is additive and presentation-only. A task belongs to an Objective only when its `Objective` ID is present and registered by the Project root's `Objective registry`; missing or unknown IDs remain ungrouped. Objective attention is a visual summary, never a lifecycle or completion object. A lineage edge exists only when the bounded projection contains both endpoints and the target explicitly names the source in `Context Predecessors`. Spatial adjacency, sorting, Objective membership, Workstream labels, and inferred chronology never create edges.

Keep the compatibility Workstream lanes in the projection for existing consumers, but do not make Workstream metadata mandatory for the primary matrix. Use CSS grid/subgrid when available with a narrow-layout fallback; keep the provider adapter, bounded cache/single-flight behavior, attention projection, OAuth `data:read` scope, and read-only boundaries unchanged. Advance the browser-local cache envelope/key version so pre-matrix snapshots are not interpreted as containing the new graph fields.

## Consequences

- Multiple projects compare on one visible NOW row without wrapping the primary project grid.
- Branch and merge context is explicit and inspectable without becoming Todoist dependency authority.
- Objective grouping helps orientation while unknown/missing metadata degrades safely.
- Narrow screens remain usable by stacking columns instead of forcing horizontal overflow.
- The extension still has no backend, task writes, polling, scheduler, second task store, MMCP dependency, client secret, or broader OAuth scope.
- Fresh authenticated provider/browser acceptance of this new surface remains a separate evidence layer from local tests and commits.
