# Requirements

## R1 — Standalone canonical read-only projection

The product operates as a standalone Chromium browser client over canonical Todoist project/task sources, with no MMCP runtime dependency, no normal-use application server requirement, no second authoritative task store, and no source mutation.

Rationale: the project-context visualization must be independently usable and must not make a personal workflow server or duplicate task database a hidden prerequisite.

Failure prevented: a viewer that looks independent but silently depends on MMCP, stores a second task truth, or mutates Todoist would create ownership and lifecycle ambiguity.

Checks: `tests/api.test.ts`, `tests/cache.test.ts`, `scripts/check-public-safety.mjs`, MV3 manifest, and manual browser load when safe authority exists.

## R2 — Semantics and bounded freshness

The projection preserves Project context v1 semantics: configurable section-boundary discovery, top-level dashboard-root filtering, bounded pagination, loose-task exclusion, goal and workstream registry, task summary/context predecessors/checkpoint, lifecycle-derived Now/Later/Blocked/Watching/Done, presentation-only lineage, salience suppression, and compact responsive line-and-box rendering. Cache freshness is explicit (`fresh`, `stale`, `expired`) with bounded stale-while-revalidate and single-flight reads.

Rationale: fast orientation is useful only when its scope and freshness are truthful.

Failure prevented: a partial/truncated provider response being presented as a complete project, or lineage being mistaken for Todoist dependency/execution authority.

Checks: `tests/projection.test.ts`, `tests/pagination.test.ts`, `tests/cache.test.ts`, `tests/renderer.test.ts`, and fixture review.

## R3 — Public privacy and least privilege

Public repository truth contains no credentials, personal data, private prototype material, or runtime state. Browser authorization uses a public Todoist OAuth client with PKCE and the least-privilege `data:read` scope; no client secret is present in public source.

Rationale: a public extension cannot safely hold a symmetric client secret and does not need write authority for a read-only view.

Failure prevented: accidental credential disclosure, excessive Todoist authority, or raw provider payloads leaking through cache/UI/errors.

Checks: `tests/auth.test.ts`, `scripts/check-public-safety.mjs`, session-only token storage, escaped UI rendering, and official platform notes.

## R4 — Maintainable public bootstrap

The repository contains durable instructions, README, requirements, specification/architecture, roadmap, decision records, task mapping, build/test tooling, CI, fixtures, and a replaceable provider/auth/cache/projection structure.

Checks: tracked docs and source layout; `npm run check`; clean public-safety scan.

## Non-goals

- Todoist task creation, editing, completion, assignment, rescheduling, or label mutation.
- A global planner, second task database, notifications, polling, scheduler, automatic wake, or AI-generated roadmap.
- MMCP edits, deployment, native host, backend, production launch, extension-store publication, or credential provisioning.

## Requirement state at bootstrap

Local contribution: complete for the initial standalone slice.

Requirement state: `unknown` pending authorized browser/provider actual-use acceptance. Local evidence alone is not direct Todoist acceptance or cutover evidence.
