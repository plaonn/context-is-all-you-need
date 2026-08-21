# Product specification

## Product surface

The extension opens a dedicated full tab. The optional toolbar action opens the same `index.html` page. The page presents a project selector, source/freshness status, goal, workstream lanes, bounded task nodes, contextual predecessor links, blocker/resume/checkpoint details, coverage, and canonical Todoist links.

## Source boundary

The user configures one Todoist section ID. The adapter reads at most four pages of active tasks at 50 items per page for discovery. Only top-level tasks (`parent_id = null`) with an exact `Project context v1:` block or the established `* 🗂️` title convention become roots; loose tasks in the same section are excluded.

For a selected root, the adapter reads the root task, at most four pages of active direct children, and at most three pages of completed direct children within the last 90 days. It reports page counts and truncation rather than implying that a bounded window is exhaustive.

## Metadata v1

Root descriptions may contain:

```text
Project context v1:
Project Goal: Make strategy changes explainable and reversible
Workstream registry:
- strategy | Strategy
- execution | Execution
```

Task descriptions may contain:

```text
Project context v1:
Workstream: execution
Summary: Validate the bounded plan before any apply
Context Predecessors: task-a, task-b
Checkpoint: Dry-run disposition recorded
```

`Context Predecessors` is presentation-only lineage. It is not a Todoist dependency, claim, scheduler input, execution order, or completion authority. Unknown fields and versions are ignored.

## Lifecycle and salience

`codex-now`, `codex-candidate`/`codex-managed`, `codex-blocked`, and `codex-watching` derive Now, Later, Blocked, and Watching. Completed source items derive Done. Nodes referenced by lineage remain visible; current-status nodes remain visible; metadata-free loose nodes and maintenance/incident/evidence/coordination noise are suppressed. Missing metadata degrades to an Unclassified lane.

## Cache contract

Discovery and selected snapshots use separate browser-local cache entries. A fresh entry lasts 60 seconds; the next five minutes are stale-while-revalidate. Stale data is returned immediately with `refreshing` and provider-error state when applicable. Expired data requires a provider read. Concurrent reads for the same key share one in-flight request. Cache values contain only projected viewer fields and coverage; no raw provider response or token is stored.

## Auth and mutation boundary

Todoist OAuth uses an explicitly initiated Dynamic Client Registration for a public client bound to the current `chrome.identity.getRedirectURL("todoist")` result, `data:read`, `chrome.identity.launchWebAuthFlow`, and PKCE. The authorization-server metadata at `https://todoist.com/.well-known/oauth-authorization-server` is the endpoint identity source: DCR, authorize, and token exchange use its `https://todoist.com` issuer, while authenticated resource reads use the separate `https://api.todoist.com/api/v1/` API origin. The non-secret registration metadata is reused from `chrome.storage.local` only when its canonical server and schema version match; older or differently bound metadata is invalidated and requires a bounded replacement on the next explicit Connect. Access and refresh tokens are kept in `chrome.storage.session`. Disconnect removes local session state while preserving the registration and does not attempt provider revocation. Token network failures, redirects, and HTTP OAuth errors produce distinct sanitized diagnostics. The Todoist data adapter issues GET requests only. The token endpoint POST is an OAuth exchange, not task/provider data mutation.
