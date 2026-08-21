# Official platform verification

Verified 2026-08-21 before binding implementation details.

## Todoist

- [Todoist API authorization and OAuth](https://developer.todoist.com/api/v1/) documents Bearer authorization, the `data:read` read-only scope, and OAuth authorization-code exchange.
- The same guide documents unauthenticated RFC 7591 Dynamic Client Registration at `POST https://api.todoist.com/oauth/register`. `redirect_uris` must be HTTPS, `scope` is space-separated, `grant_types` must include `authorization_code`, `response_types` must include `code`, and `token_endpoint_auth_method: "none"` selects a public PKCE client. Dynamic client IDs use the `tdd_` prefix, and the endpoint is rate limited per caller.
- For this extension, registration requests exactly `data:read`, `authorization_code` plus `refresh_token`, `response_types: ["code"]`, and `token_endpoint_auth_method: "none"`. The returned non-secret client ID is stored with the exact Chromium redirect URI and a registration schema version; no client secret is requested or persisted. Todoist's `none` token endpoint authentication omits `client_secret`, while refresh tokens rotate on successful refresh.
- The guide also documents OAuth Client ID Metadata Documents as an alternative public-client flow. That historical capability is not part of normal first-run setup because it would require the user to host a public HTTPS document.
- The guide documents CORS support for API endpoints, so the extension can call Todoist directly without an application server.
- The guide documents cursor pagination (`results`, `next_cursor`, and `cursor`) and the task/completed-task query boundaries used here.

Implementation consequence: `src/core/auth.ts` derives the current redirect identity on explicit Connect, reuses a matching local registration, registers a bounded replacement after redirect drift, requests only `data:read`, sends PKCE parameters, and never models a client secret. `src/core/api.ts` calls the API directly with GET-only reads and bounded cursors.

## Chromium

- [chrome.identity](https://developer.chrome.com/docs/extensions/reference/api/identity) documents `getRedirectURL(path)` as generating `https://<app-id>.chromiumapp.org/*` redirect URLs and `launchWebAuthFlow` for non-Google providers. Its UX guidance requires an explanatory UI action and explicitly says not to launch an interactive flow when the app first launches.
- [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) documents extension-local storage and `storage.session` as in-memory MV3 storage cleared with extension/browser lifecycle.
- [MV3 service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers) document the ephemeral background model and the need to persist needed state through extension storage.

Implementation consequence: the page is a full tab, the toolbar action only opens that page, access/refresh tokens use session storage, and the projected cache is browser-local rather than server-backed.

## Constraint and evidence note

These are primary documentation checks, not provider/browser dogfood. The repository has no credentials, client registration, extension-store key, or production deployment. Actual-use acceptance remains unverified until safe local authority is explicitly available.
