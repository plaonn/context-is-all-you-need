# Requirements

## R1 — Standalone canonical read-only projection

The product operates as a standalone Chromium browser client over canonical Todoist project/task sources, with no MMCP runtime dependency, no normal-use application server requirement, no second authoritative task store, and no source mutation.

Rationale: the project-context visualization must be independently usable and must not make a personal workflow server or duplicate task database a hidden prerequisite.

Failure prevented: a viewer that looks independent but silently depends on MMCP, stores a second task truth, or mutates Todoist would create ownership and lifecycle ambiguity.

Checks: `tests/api.test.ts`, `tests/cache.test.ts`, `scripts/check-public-safety.mjs`, MV3 manifest, and manual browser load when safe authority exists.

## R2 — Context matrix semantics and bounded freshness

The projection preserves Project context v1 semantics beneath a multi-Context recovery matrix: each local Context maps to one section; selected-context discovery shows all eligible project roots in parallel; wide-screen Project columns share a stable semantic NOW band with bounded before/after context; narrow layouts transpose the same columns vertically. Compact columns show goal/state, material blocked or explicitly populated decision attention, lower-salience passive watching, optional registered Objective grouping, and explicit Context Predecessors as presentation-only branch/merge lineage; expanded columns progressively load bounded deep history and resume-critical attention detail. Configurable section-boundary discovery, top-level dashboard-root filtering, bounded pagination, loose-task exclusion, goal/workstream/Objective registries, task summary/context predecessors/checkpoint, lifecycle-derived Now/Later/Blocked/Watching/Done, attention suppression for routine/resolved/obsolete residue, and safe missing-field degradation remain intact. Cache freshness is explicit (`fresh`, `stale`, `expired`) with bounded stale-while-revalidate, per-Context/project entries, bounded concurrency, isolated partial failures, and single-flight reads.

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

## Non-goals

- Todoist task creation, editing, completion, assignment, rescheduling, or label mutation.
- A global planner, second task database, notifications, polling, scheduler, automatic wake, or AI-generated roadmap.
- MMCP edits, deployment, native host, backend, production launch, extension-store publication, or credential provisioning.

## Requirement state at bootstrap

Local contribution: complete for the initial standalone slice.

Requirement state: `satisfied` for standalone acceptance. The user directly verified the clean unpacked-extension path after reload, without a DevTools fetch wrapper: canonical DCR/consent/PKCE token exchange, authenticated Todoist data reads, and project-context UI rendering all succeeded. Standalone cutover is `ready`; the MMCP-removal hold from this task is released, while any removal remains a separate authorized workstream. Non-blocking UX improvements are a separate product follow-up and do not change this Requirement state.

## Context matrix revision state

The multi-Context matrix is locally implemented and covered by deterministic synthetic tests and structural layout checks. The prior direct browser evidence applies to the accepted standalone OAuth/read path; it does not by itself claim fresh provider/browser acceptance of this new matrix surface. No new provider write, OAuth scope, server, or MMCP dependency was introduced. The local cache envelope/key version was advanced so pre-matrix snapshots are discarded rather than interpreted as if they contained the new graph fields.
