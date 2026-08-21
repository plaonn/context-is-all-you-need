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

Configuration is stored in `chrome.storage.local` because it contains only a section boundary and non-secret Dynamic Client Registration metadata (`clientId`, issuer provenance, exact registration/authorization/token endpoint identities, exact `redirectUri`, and `registrationVersion`). Registration version 3 binds the concrete endpoints to `api.todoist.com/oauth/register`, `app.todoist.com/oauth/authorize`, and `api.todoist.com/oauth/access_token`; it does not derive them from the `todoist.com` issuer. Older, differently routed, or incomplete metadata normalizes to empty and is re-registered on the next explicit Connect. OAuth access/refresh tokens and projected cache entries use `chrome.storage.session`, which Chromium documents as in-memory and cleared when the extension/browser session ends. Cache persistence is a performance aid, not canonical state.

## Failure handling

Provider failures are reduced to typed status messages and a bounded stale/error projection. Token network failures, HTTP OAuth errors, redirects, and client-registration mismatches remain distinguishable without exposing raw response bodies, response descriptions, or credential material. Unauthorized API reads request one token refresh through the auth provider and retry once; all other failures remain visible and do not trigger polling or automatic wake.
