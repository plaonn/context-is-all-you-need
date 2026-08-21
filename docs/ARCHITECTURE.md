# Architecture

```text
Chromium full tab / optional toolbar action
        │
        ├── extension/app.ts ── config + session storage
        │                         │
        │                         ├── TodoistOAuthClient (public PKCE)
        │                         ├── TodoistApi (GET-only data adapter)
        │                         └── ProjectContextCache (fresh/stale/expired/SWR)
        │                                  │
        │                                  └── projection + metadata parser
        │                                             │
        │                                             └── escaped line-and-box renderer
        └── extension/service-worker.ts ── opens the full tab
```

## Ownership boundaries

- `src/core/metadata.ts`, `projection.ts`, and `model.ts` own public-safe Project context v1 semantics.
- `src/core/pagination.ts` owns cursor traversal and explicit bounded coverage.
- `src/core/api.ts` owns the replaceable Todoist GET-only adapter and never imports MMCP.
- `src/core/auth.ts` owns Todoist Dynamic Client Registration, public-client PKCE, redirect binding, state verification, token exchange, and safe errors; it has no client-secret field.
- `src/core/cache.ts` owns browser-local projected cache and single-flight/SWR behavior.
- `src/core/renderer.ts` owns escaped presentation-only HTML; links point back to canonical Todoist.
- `src/extension/` owns MV3 page wiring and optional toolbar action.

There is no backend, native host, SQLite/file cache, content script, task write adapter, or second task authority.

## Extension storage

Configuration is stored in `chrome.storage.local` because it contains only a section boundary and non-secret Dynamic Client Registration metadata (`clientId`, exact `redirectUri`, and `registrationVersion`). OAuth access/refresh tokens and projected cache entries use `chrome.storage.session`, which Chromium documents as in-memory and cleared when the extension/browser session ends. Cache persistence is a performance aid, not canonical state.

## Failure handling

Provider failures are reduced to typed status messages and a bounded stale/error projection. Raw response bodies are never copied to errors or cache. Unauthorized API reads request one token refresh through the auth provider and retry once; all other failures remain visible and do not trigger polling or automatic wake.
