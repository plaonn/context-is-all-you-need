# Product specification

## Product surface

The extension opens a dedicated full tab. The optional toolbar action opens the same `index.html` page. The page presents:

- a local Context selector and settings surface;
- a wide-screen Context matrix with one stable horizontal Project column for every project root in the selected Context;
- a shared semantic NOW band with bounded recent context above and immediate next/resume context below each column;
- explicit short-term Objective regions, branch/merge lineage derived from Context Predecessors, project goal/state counts, current or blocked attention, and canonical Todoist links; and
- progressive project history/detail, source coverage, and explicit freshness/partial-read status.

On narrow layouts the matrix transposes to vertically stacked Project columns while preserving the same node, Objective, status, and lineage semantics. Objective regions, graph edges, and predecessor links are presentation-only. They do not create dependencies or alter Todoist lifecycle.

## Local unpacked distribution

`npm run build` is checkout-local: it removes and recreates only that checkout's ignored `dist/`, compiles the current source, copies the MV3 page/manifest assets, and writes a deterministic `dist/build-info.json` containing the full source revision and whether tracked or untracked source changes were present. The build then verifies the marker, manifest, options-page script/style references, and required runtime entrypoints. The page header reads the marker from the extension package and shows a short revision; if the marker is absent or invalid, it tells the user to rebuild before loading.

The documented installation flow therefore builds and loads `dist/` from the same checkout. A generated directory left by another worktree is not refreshed by Git integration and is not accepted as current merely because its manifest is present.

## Source boundary

The user keeps a browser-local list of Context mappings. Each mapping has a local key, label, and one Todoist section ID; mapping edits never write to Todoist. Existing `sectionId` configuration migrates to a single `Current context` mapping without repeating OAuth setup. A board read uses only the selected Context's section boundary.

For discovery, the adapter reads at most four pages of section tasks at 50 items per page. Only top-level tasks (`parent_id = null`) with an exact `Project context v1:` block or the established `* 🗂️` title convention become roots; loose tasks in the same section are excluded.

For the initial board, each discovered root receives a compact read: the root, at most two pages of active direct children, and at most one page of recent completed direct children. The board therefore does not synchronously read the full deep history of every project, while a recent completed predecessor can remain visually subordinate in the connected map. One compact-read failure is retained on that project card while other cards remain usable.

When a project is expanded, the adapter reads the root, at most four pages of active direct children, and at most three pages of completed direct children within the last 90 days. It reports page counts and truncation rather than implying that a bounded window is exhaustive.

## Metadata v1

Root descriptions may contain:

```text
Project context v1:
Project Goal: Make strategy changes explainable and reversible
Workstream registry:
- strategy | Strategy
- execution | Execution

Objective registry:
- recovery | Recovery
- delivery | Delivery
```

Task descriptions may contain:

```text
Project context v1:
Workstream: execution
Objective: delivery
Summary: Validate the bounded plan before any apply
Context Predecessors: task-a, task-b
Checkpoint: Dry-run disposition recorded
```

`Context Predecessors` is presentation-only lineage. It is not a Todoist dependency, claim, scheduler input, execution order, or completion authority. Unknown fields and versions are ignored.

`Objective registry` and task-level `Objective` are an additive grouping contract. A task is grouped only when its Objective ID is explicitly present and registered on the Project root. Missing or unknown IDs remain ungrouped. Objective attention may be highlighted from current, blocked, or watching members for orientation, but the Objective never becomes a lifecycle object and no Objective state is inferred from bounded absence of active tasks.

The projection exposes a flat graph view in addition to the compatibility Workstream lanes. The graph has three semantic bands (`before`, `now`, `after`) and explicit edges only for predecessor IDs whose source and target nodes are both present in the bounded projection. Spatial adjacency, sorting, Objective membership, and Workstream labels never create an edge.

### Bounded attention packet

Task descriptions may also carry the existing bounded exception/decision fields:

```text
Blocked on: Receiver contract
Why worker cannot decide: Authority is not present in current evidence
Decision owner: ChatGPT
Recommended safe/default path: Preserve the read-only adapter
Alternatives: Wait for owner confirmation
Safe state preserved: No writes attempted
Independent work completed: Local validation
Resume condition: A durable decision is published
Evidence/provenance: Bounded source reference
```

These fields are optional, individually bounded, and presentation-only. The board
does not infer a decision owner, approval, execution order, or authority when a
field is missing. Material `codex-blocked` or explicitly populated decision
packets receive high-salience compact attention; passive `codex-watching` keeps
lower salience and its resume condition. Completed, resolved, obsolete, or
superseded residue is not promoted to attention. Full resume-critical fields are
shown only after bounded project expansion, while compact cards show where, why,
owner when explicitly supplied, and the recommended next path when available.

## Lifecycle and salience

`codex-now`, `codex-candidate`/`codex-managed`, `codex-blocked`, and `codex-watching` derive Now, Later, Blocked, and Watching. Completed source items derive Done. Nodes referenced by lineage remain visible; current-status nodes remain visible; metadata-free loose nodes and maintenance/incident/evidence/coordination noise are suppressed. Missing metadata degrades to an Unclassified lane. Attention fields never create a new lifecycle or task authority; they only add a bounded recovery summary to an existing projection.

## Cache contract

The board cache keeps discovery per Context, compact snapshots per project, and deep snapshots per expanded project in browser-local session storage. A fresh entry lasts 60 seconds; the next five minutes are stale-while-revalidate. Stale data is returned immediately with `refreshing` and provider-error state when applicable; the user can request a refresh explicitly. Expired data requires a provider read. Compact project reads are bounded to four concurrent projects by default, and concurrent reads for the same key share one in-flight request. Cache values contain only projected viewer fields and coverage; no raw provider response or token is stored.

## Auth and mutation boundary

Todoist OAuth uses an explicitly initiated Dynamic Client Registration at `https://api.todoist.com/oauth/register` for a public client bound to the current `chrome.identity.getRedirectURL("todoist")` result, then uses `https://app.todoist.com/oauth/authorize` for consent and `https://api.todoist.com/oauth/access_token` for token exchange/refresh. The flow requests `data:read`, uses `chrome.identity.launchWebAuthFlow`, and uses PKCE/state. The current authorization-server metadata at `https://todoist.com/.well-known/oauth-authorization-server` supplies issuer provenance but its endpoint fields conflict with the concrete API guide; endpoint URLs are explicit identities and are never synthesized from the issuer. The non-secret registration metadata is reused from `chrome.storage.local` only when its issuer, all concrete endpoint bindings, redirect URI, and schema version match; older or differently bound metadata is invalidated and requires a bounded replacement on the next explicit Connect. Access and refresh tokens are kept in `chrome.storage.session`. Disconnect removes local session state while preserving the registration and does not attempt provider revocation. Token network failures, redirects, and HTTP OAuth errors produce distinct sanitized diagnostics. The Todoist data adapter issues GET requests only. The token endpoint POST is an OAuth exchange, not task/provider data mutation.
