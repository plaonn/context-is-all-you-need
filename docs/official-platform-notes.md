# Official platform verification

Verified 2026-08-21 before binding implementation details, including a direct read of the current authorization-server metadata.

## Todoist

- [Todoist API authorization and OAuth](https://developer.todoist.com/api/v1/) documents Bearer authorization, the `data:read` read-only scope, and OAuth authorization-code exchange.
- The guide still shows the historical `api.todoist.com` registration and `app.todoist.com` authorization examples. Those examples are not treated as the current authorization-server identity by this extension.
- The live [OAuth authorization-server metadata](https://todoist.com/.well-known/oauth-authorization-server) advertises issuer `https://todoist.com`, dynamic registration, `code` responses, `S256` PKCE, `authorization_code` and `refresh_token` grants, `none` token-endpoint authentication, and `data:read`. Its registration, authorization, and token endpoints are respectively `https://todoist.com/oauth/register`, `https://todoist.com/oauth/authorize`, and `https://todoist.com/oauth/access_token`.
- For this extension, registration requests exactly `data:read`, `authorization_code` plus `refresh_token`, `response_types: ["code"]`, and `token_endpoint_auth_method: "none"`. The returned non-secret client ID is stored with the exact Chromium redirect URI and a registration schema version; no client secret is requested or persisted. Todoist's `none` token endpoint authentication omits `client_secret`, while refresh tokens rotate on successful refresh.
- The guide also documents OAuth Client ID Metadata Documents as an alternative public-client flow. That historical capability is not part of normal first-run setup because it would require the user to host a public HTTPS document.
- The guide documents CORS support for API endpoints, so the extension can call Todoist directly without an application server.
- The guide documents cursor pagination (`results`, `next_cursor`, and `cursor`) and the task/completed-task query boundaries used here.

Implementation consequence: `src/core/auth.ts` uses the metadata issuer as the single authorization-server origin for DCR, authorization, and token exchange. A registration schema bump invalidates pre-canonical registrations, so an unpacked extension does not send a client registered against the old endpoint identity to the new server. `src/core/auth.ts` derives the current redirect identity on explicit Connect, reuses only a matching canonical registration, registers a bounded replacement after redirect drift, requests only `data:read`, sends PKCE parameters, and never models a client secret. `src/core/api.ts` intentionally remains on the Todoist resource API at `https://api.todoist.com/api/v1/` and calls it directly with GET-only reads and bounded cursors.

Token failures are sanitized by class: a fetch rejection is a network diagnostic, an HTTP OAuth response is reported with status and an allowlisted OAuth error code, and client-identity errors request a fresh registration. Response descriptions and credential material are never surfaced.

## Chromium

- [chrome.identity](https://developer.chrome.com/docs/extensions/reference/api/identity) documents `getRedirectURL(path)` as generating `https://<app-id>.chromiumapp.org/*` redirect URLs and `launchWebAuthFlow` for non-Google providers. Its UX guidance requires an explanatory UI action and explicitly says not to launch an interactive flow when the app first launches.
- [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) documents extension-local storage and `storage.session` as in-memory MV3 storage cleared with extension/browser lifecycle.
- [MV3 service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers) document the ephemeral background model and the need to persist needed state through extension storage.

Implementation consequence: the page is a full tab, the toolbar action only opens that page, access/refresh tokens use session storage, and the projected cache is browser-local rather than server-backed.

## Constraint and evidence note

These are primary documentation and metadata checks, not provider/browser dogfood. The repository has no credentials, client registration, extension-store key, or production deployment. Actual-use acceptance remains a separate evidence layer and is not inferred from this document.
