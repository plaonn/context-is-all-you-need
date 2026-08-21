# Official platform verification

Verified 2026-08-21 before binding implementation details.

## Todoist

- [Todoist API authorization and OAuth](https://developer.todoist.com/api/v1/) documents Bearer authorization, the `data:read` read-only scope, and OAuth authorization-code exchange.
- The same guide documents public OAuth client support through an HTTPS OAuth Client ID Metadata Document with `token_endpoint_auth_method: "none"`; public clients use PKCE instead of a client secret.
- The guide documents CORS support for API endpoints, so the extension can call Todoist directly without an application server.
- The guide documents cursor pagination (`results`, `next_cursor`, and `cursor`) and the task/completed-task query boundaries used here.

Implementation consequence: `src/core/auth.ts` requires a user-supplied HTTPS metadata URL, requests only `data:read`, sends PKCE parameters, and never models a client secret. `src/core/api.ts` calls the API directly with GET-only reads and bounded cursors.

## Chromium

- [chrome.identity](https://developer.chrome.com/docs/extensions/reference/api/identity) documents `launchWebAuthFlow`, generated `https://<app-id>.chromiumapp.org/*` redirect URLs, and interactive flow guidance.
- [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) documents extension-local storage and `storage.session` as in-memory MV3 storage cleared with extension/browser lifecycle.
- [MV3 service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers) document the ephemeral background model and the need to persist needed state through extension storage.

Implementation consequence: the page is a full tab, the toolbar action only opens that page, access/refresh tokens use session storage, and the projected cache is browser-local rather than server-backed.

## Constraint and evidence note

These are primary documentation checks, not provider/browser dogfood. The repository has no credentials, client registration, extension-store key, or production deployment. Actual-use acceptance remains unverified until safe local authority is explicitly available.
