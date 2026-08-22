# Architecture

```text
Chromium full tab / optional toolbar action
        │
        ├── extension/app.ts ── local Context mappings + session storage
        │                         │
        │                         ├── TodoistOAuthClient (public PKCE)
        │                         ├── TodoistApi (GET-only data adapter)
        │                         └── ProjectContextBoardCache
        │                              (per-Context/project compact + deep SWR)
        │                                  │
        │                                  └── projection + metadata parser
        │                                             │
        │                                             └── escaped Context matrix renderer
        └── extension/service-worker.ts ── opens the full tab
```

## Ownership boundaries

- `src/core/metadata.ts`, `projection.ts`, and `model.ts` own public-safe Project context v1 semantics plus the optional bounded attention, Objective, and explicit lineage projection. Attention fields are copied only when present, Objective membership is accepted only for registered IDs, and neither becomes execution or approval authority.
- `src/core/pagination.ts` owns cursor traversal and explicit bounded coverage.
- `src/core/api.ts` owns the replaceable Todoist GET-only adapter and never imports MMCP.
- `src/core/auth.ts` owns Todoist Dynamic Client Registration, public-client PKCE, redirect binding, state verification, token exchange, and safe errors; it has no client-secret field. `src/core/transport.ts` supplies a receiver-neutral fetch transport so native global fetch is never invoked as a class member while injected fetchers remain testable.
- `src/core/cache.ts` owns browser-local projected cache and single-flight/SWR behavior. The board cache bounds compact project concurrency, isolates per-project failures, and keeps deep reads behind explicit expansion; the original single-project cache remains for Project context v1 compatibility.
- `src/core/renderer.ts` owns escaped presentation-only HTML; the board renders horizontally arranged Project columns with content-sized recent/NOW/next rows, Objective regions that spatially enclose member blocks, and inline SVG branch/merge paths whose inputs are only explicit lineage edges. The accessible explicit edge list is a secondary disclosure. Compact columns surface where/why/next attention and expanded columns show bounded resume-critical fields; links point back to canonical Todoist.
- `src/extension/config.ts` owns browser-local Context mappings and one-section migration; `src/extension/` owns MV3 page wiring and optional toolbar action.
- `scripts/build.mjs` owns checkout-local unpacked artifact generation; `scripts/verify-build.mjs` validates deterministic source revision provenance and required MV3 runtime entrypoints. The generated marker is an identity/readability aid, not a second source or lifecycle store.

There is no backend, native host, SQLite/file cache, content script, task write adapter, or second task authority.

## Unpacked artifact boundary

The repository keeps `dist/` ignored so worktrees do not commit generated output. That means an ignored directory in another checkout can be stale after a source push. The build binds the generated package to the invoking checkout's Git revision in `build-info.json`, and the runtime displays that binding. Build verification is local and deterministic; it does not publish, deploy, or grant provider authority.

## Extension storage

Configuration is stored in `chrome.storage.local` because it contains only local Context mappings and non-secret Dynamic Client Registration metadata (`clientId`, issuer provenance, exact registration/authorization/token endpoint identities, exact `redirectUri`, and `registrationVersion`). Registration version 3 binds the concrete endpoints to `api.todoist.com/oauth/register`, `app.todoist.com/oauth/authorize`, and `api.todoist.com/oauth/access_token`; it does not derive them from the `todoist.com` issuer. Older, differently routed, or incomplete metadata normalizes to empty and is re-registered on the next explicit Connect. OAuth access/refresh tokens and projected board cache entries use `chrome.storage.session`, which Chromium documents as in-memory and cleared when the extension/browser session ends. Cache persistence is a performance aid, not canonical state.

## Failure handling

Provider failures are reduced to typed status messages and a bounded stale/error projection. Token network failures, HTTP OAuth errors, redirects, and client-registration mismatches remain distinguishable without exposing raw response bodies, response descriptions, or credential material. Unauthorized API reads request one token refresh through the auth provider and retry once; all other failures remain visible and do not trigger polling or automatic wake.
