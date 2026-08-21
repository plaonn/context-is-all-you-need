# Acceptance ledger

| Evidence layer | Current state | Notes |
| --- | --- | --- |
| Public-safe extraction | complete | Semantics reimplemented from read-only MMCP reference inspection; no private payload copied. |
| Local implementation | complete for this revision | `npm run check` passed: typecheck, 31 tests, MV3 build, and public-safety scan; canonical endpoint identity, stale-registration invalidation, PKCE token exchange, receiver-neutral fetch transport, sanitized network/HTTP OAuth diagnostics, refresh-token retention, and read-only boundaries are synthetic-tested. |
| Hosted CI workflow | intentionally omitted | The approved task requires build/test tooling and direct validation, not GitHub Actions; `npm run check` is the canonical validation surface. |
| Official platform constraints | verified 2026-08-21 | Primary Todoist DCR/OAuth and Chromium identity docs plus the current Todoist authorization-server metadata are linked in `docs/official-platform-notes.md`; issuer provenance is separated from the concrete API/consent/token endpoint contract. |
| Provider/controller path | positive with temporary wrapper; clean path pending | On canonical `8ccb79b`, the user's temporary receiver-neutral `window.fetch` arrow wrapper reached `POST https://api.todoist.com/oauth/access_token` with HTTP 200 and subsequent authenticated section, pagination, root, child, and completed-task reads with HTTP 200. The project-context UI rendered. This proves the provider/API/CORS path and authenticated first GET work, but the wrapper-assisted run is not clean production-path acceptance. |
| Actual Chromium use | wrapper-assisted success; clean production path pending | The user performed the real DCR → consent → callback → PKCE exchange and readback in the unpacked extension with the DevTools wrapper enabled. Direct Codex inspection of `chrome-extension://` content remains unavailable and was not repeated. A no-wrapper run is still required. |
| Standalone parity/cutover | not-ready | The receiver-neutral transport fix must be loaded and verified without the DevTools wrapper. No MMCP removal or standalone cutover is authorized until clean token 200, authenticated first GET, and UI render are directly observed. |

Tests, commits, and a clean worktree are not substitutes for provider/browser acceptance.
