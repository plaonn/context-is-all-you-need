# ADR 0004: Context board as a bounded parallel overview

Status: accepted for the Context board revision

## Context

The standalone viewer's first surface selected one Project root at a time. That made a user choose a project before seeing the current workstream shape of a higher-level Context. The accepted Project context v1 semantics and Todoist read-only boundary must remain stable while the overview becomes multi-project.

## Decision

Keep a browser-local list of high-level Context mappings, with one Todoist section per mapping. For the selected Context, discover eligible project roots once and render all roots as compact cards. Each card uses a bounded root plus active-child read and groups salient nodes by registered workstream. Connectors and predecessor links are explicitly presentation-only.

Load full active/recent-completed history only when a user expands a project. Cache discovery per Context, compact and deep projections per project, cap compact reads at four concurrent projects by default, and keep one provider failure on its project card without hiding other cards. Existing one-section configuration migrates to one local Context mapping without repeating OAuth registration.

## Consequences

- Orientation no longer requires choosing a Project first.
- The first board read does not synchronously fetch deep history for every project.
- Context mappings and cache entries are local browser state; Todoist remains the sole task and lifecycle authority.
- The original `ProjectContextCache` and renderer remain available for Project context v1 compatibility and deterministic regression coverage.
- A materially different product model, server, provider write, broader OAuth scope, or cross-repository source-of-truth change remains reserved.
