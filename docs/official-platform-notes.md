# Official platform verification

Verified 2026-08-21 before binding implementation details, including a direct read of the current authorization-server metadata and the current Todoist API OAuth/DCR guide.

## Todoist

- [Todoist API authorization and OAuth](https://developer.todoist.com/api/v1/) documents the concrete OAuth endpoints used by this client:

  | Role | Exact endpoint |
  | --- | --- |
  | Dynamic Client Registration | `https://api.todoist.com/oauth/register` |
  | Authorization/consent | `https://app.todoist.com/oauth/authorize` |
  | Authorization-code exchange and refresh | `https://api.todoist.com/oauth/access_token` |
  | Authenticated resource reads | `https://api.todoist.com/api/v1/` |

- The guide explicitly documents `token_endpoint_auth_method: "none"` as the public-client option. This client therefore sends no `client_secret` and uses PKCE/state instead.
- The current [OAuth authorization-server metadata](https://todoist.com/.well-known/oauth-authorization-server) reports issuer `https://todoist.com`, but currently advertises all three OAuth endpoint fields under `https://todoist.com`. That conflicts with the concrete endpoint URLs in the API guide and the user's live token-exchange result. The issuer is not an endpoint URL template: this implementation records it as provenance and pins each concrete endpoint independently; it does not synthesize endpoint URLs from the issuer or blindly use the conflicting metadata endpoint fields.
- Registration requests exactly `data:read`, `authorization_code` plus `refresh_token`, `response_types: ["code"]`, and `token_endpoint_auth_method: "none"`. The returned non-secret client ID is stored with the exact Chromium redirect URI, issuer provenance, all three concrete endpoint identities, and a registration schema version. A registration that does not match every binding is discarded and replaced only on the next explicit Connect.
- The guide also documents OAuth Client ID Metadata Documents as an alternative public-client flow. That capability is not part of normal first-run setup because it would require the user to host a public HTTPS document.
- The guide documents CORS support for API endpoints, so the extension can call Todoist directly without an application server.
- The guide documents cursor pagination (`results`, `next_cursor`, and `cursor`) and the task/completed-task query boundaries used here.

Implementation consequence: `src/core/auth.ts` uses the exact documented endpoint constants above. Registration schema version 3 invalidates the previous issuer-derived version 2 and any older/mixed endpoint binding, so an unpacked extension does not send a client registered against the old routing to the new flow. The client derives the current redirect identity on explicit Connect, reuses only a fully matching registration, registers a bounded replacement after redirect drift, requests only `data:read`, sends PKCE parameters, and never models a client secret. `src/core/api.ts` remains on the Todoist resource API and calls it directly with GET-only reads and bounded cursors.

Token failures are sanitized by class: a fetch rejection is a network diagnostic, an HTTP OAuth response is reported with status and an allowlisted OAuth error code, and client-identity errors request a fresh registration. Response descriptions and credential material are never surfaced.

## Chromium

- [chrome.identity](https://developer.chrome.com/docs/extensions/reference/api/identity) documents `getRedirectURL(path)` as generating `https://<app-id>.chromiumapp.org/*` redirect URLs and `launchWebAuthFlow` for non-Google providers. Its UX guidance requires an explanatory UI action and explicitly says not to launch an interactive flow when the app first launches.
- [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) documents extension-local storage and `storage.session` as in-memory MV3 storage cleared with extension/browser lifecycle.
- [MV3 service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers) document the ephemeral background model and the need to persist needed state through extension storage.

Implementation consequence: the page is a full tab, the toolbar action only opens that page, access/refresh tokens use session storage, and the projected cache is browser-local rather than server-backed.

## Constraint and evidence note

These are primary documentation and metadata checks, not provider/browser dogfood. The repository has no credentials, client registration, extension-store key, or production deployment. Actual-use acceptance remains a separate evidence layer and is not inferred from this document.
