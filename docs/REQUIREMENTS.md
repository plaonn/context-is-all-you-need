# Requirements

## R1 — Standalone canonical read-only projection

The product operates as a standalone Chromium browser client over canonical Todoist project/task sources, with no MMCP runtime dependency, no normal-use application server requirement, no second authoritative task store, and no source mutation.

Rationale: the project-context visualization must be independently usable and must not make a personal workflow server or duplicate task database a hidden prerequisite.

Failure prevented: a viewer that looks independent but silently depends on MMCP, stores a second task truth, or mutates Todoist would create ownership and lifecycle ambiguity.

Checks: `tests/api.test.ts`, `tests/cache.test.ts`, `scripts/check-public-safety.mjs`, MV3 manifest, and manual browser load when safe authority exists.

## R2 — Context matrix semantics and bounded freshness

The projection preserves Project context v1 semantics beneath a multi-Context recovery plane: each local Context maps to one section; selected-context discovery shows all eligible project roots in parallel; the unified wide-screen graph plane uses compact horizontal project coordinate lanes on one semantic Y-axis, with a single NOW rule through current nodes and bounded past/near-future depth shared across lanes; narrow layouts transpose the lanes vertically. Compact lanes show goal/state, material blocked or explicitly populated decision attention beside the affected node, lower-salience passive watching, optional registered Objective enclosure, and explicit Context Predecessors as presentation-only branch/merge lineage; expanded lanes progressively load bounded deep history and resume-critical attention detail. Configurable section-boundary discovery, top-level dashboard-root filtering, bounded pagination, loose-task exclusion, goal/workstream/Objective registries, task summary/context predecessors/checkpoint, lifecycle-derived Now/Later/Blocked/Watching/Done, attention suppression for routine/resolved/obsolete residue, and safe missing-field degradation remain intact. Cache freshness is explicit (`fresh`, `stale`, `expired`) with bounded stale-while-revalidate, per-Context/project entries, bounded concurrency, isolated partial failures, and single-flight reads.

Rationale: fast orientation is useful only when its scope and freshness are truthful.

Failure prevented: a partial/truncated provider response being presented as complete, all project detail being fetched synchronously before orientation, or lineage being mistaken for Todoist dependency/execution authority.

Checks: `tests/config.test.ts`, `tests/projection.test.ts`, `tests/pagination.test.ts`, `tests/api.test.ts`, `tests/cache.test.ts`, `tests/renderer.test.ts`, `tests/layout.test.ts`, and fixture review.

## R3 — Public privacy and least privilege

Public repository truth contains no credentials, personal data, private prototype material, or runtime state. Browser authorization uses a dynamically registered public Todoist OAuth client with PKCE and the least-privilege `data:read` scope; the registration is bound to the current Chromium redirect identity, and no client secret is present in public source or browser configuration.

Rationale: a public extension cannot safely hold a symmetric client secret and does not need write authority for a read-only view. Concrete OAuth endpoint identities must follow Todoist's current documented contract rather than being synthesized from an issuer, and token diagnostics must distinguish network failure from an HTTP OAuth rejection without exposing response details.

Failure prevented: accidental credential disclosure, excessive Todoist authority, or raw provider payloads leaking through cache/UI/errors.

Checks: `tests/auth.test.ts`, `scripts/check-public-safety.mjs`, session-only token storage, escaped UI rendering, and official platform notes.

## R4 — Maintainable public bootstrap

The repository contains durable instructions, README, requirements, specification/architecture, roadmap, decision records, task mapping, build/test tooling, fixtures, and a replaceable provider/auth/cache/projection structure.

Checks: tracked docs and source layout; `npm run check`; clean public-safety scan.

## R5 — Identifiable unpacked artifact

The documented local installation path must produce an unpacked MV3 artifact whose full source revision is recorded in a deterministic `dist/build-info.json` marker. The build verifies the marker, manifest, options-page entrypoint, and module service worker before reporting success, and the loaded page exposes the marker state so an ignored artifact from another checkout cannot be mistaken for the current source.

Rationale: `dist/` is intentionally ignored and each worktree builds its own copy. Git integration updates tracked source but cannot refresh a different checkout's generated directory.

## Non-goals

- Todoist task creation, editing, completion, assignment, rescheduling, or label mutation.
- A global planner, second task database, notifications, polling, scheduler, automatic wake, or AI-generated roadmap.
- MMCP edits, deployment, native host, backend, production launch, extension-store publication, or credential provisioning.
- Public/store/release publication as part of local artifact freshness reconciliation.

## Requirement state at bootstrap

Local contribution: complete for the initial standalone slice.

Requirement state: `satisfied` for standalone acceptance. The user directly verified the clean unpacked-extension path after reload, without a DevTools fetch wrapper: canonical DCR/consent/PKCE token exchange, authenticated Todoist data reads, and project-context UI rendering all succeeded. Standalone cutover is `ready`; the MMCP-removal hold from this task is released, while any removal remains a separate authorized workstream. Non-blocking UX improvements are a separate product follow-up and do not change this Requirement state.

## Context matrix revision state

The multi-Context matrix is locally implemented and covered by deterministic synthetic tests and structural layout checks. The prior direct browser evidence applies to the accepted standalone OAuth/read path; it does not by itself claim fresh provider/browser acceptance of this new matrix surface. No new provider write, OAuth scope, server, or MMCP dependency was introduced. The local cache envelope/key version was advanced so pre-matrix snapshots are discarded rather than interpreted as if they contained the new graph fields.

## Unpacked artifact reconciliation state

The checkout-bound artifact correction is integrated at `f2eb4f8`, and the canonical ignored `dist/` was rebuilt and verified against that exact clean source revision. Current-revision Chromium startup/read acceptance remains a separate unverified evidence layer; it is not inferred from the build, tests, commit, or canonical artifact readback.
