# ADR 0002: Preserve Project context v1 as a presentation projection

Status: accepted for bootstrap

## Context

The accepted MMCP prototype already defines bounded Todoist section discovery, root filtering, metadata parsing, lifecycle lanes, salience rules, contextual predecessors, and disposable fresh/stale cache behavior. The browser client is a new owner of the visualization capability, not a license to redefine task lifecycle or source authority.

Reference read: accepted public-safe MMCP revision `730c1b8`, including `src/todoist-project-context.ts`, `src/todoist-project-context-cache.ts`, `src/todoist-rest.ts`, the corresponding tests, and `docs/project-context-viewer.md`.

## Decision

Port the semantics into dependency-free browser core modules and keep contextual predecessors presentation-only. Todoist remains the sole task/lifecycle authority; no sidecar store or mutation surface is introduced.

## Consequences

- Local synthetic fixtures can prove parity and privacy properties without copying private task payloads.
- Bounded coverage and truncation are visible in the UI.
- A future semantic change requires a new decision and direct acceptance, not an incidental UI refactor.
