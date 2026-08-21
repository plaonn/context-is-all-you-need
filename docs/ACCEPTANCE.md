# Acceptance ledger

| Evidence layer | Current state | Notes |
| --- | --- | --- |
| Public-safe extraction | complete | Semantics reimplemented from read-only MMCP reference inspection; no private payload copied. |
| Local implementation | complete for this revision | `npm run check` passed: typecheck, 26 tests, MV3 build, and public-safety scan; canonical endpoint identity, stale-registration invalidation, PKCE token exchange, sanitized network/HTTP OAuth diagnostics, refresh-token retention, and read-only boundaries are synthetic-tested. |
| Hosted CI workflow | intentionally omitted | The approved task requires build/test tooling and direct validation, not GitHub Actions; `npm run check` is the canonical validation surface. |
| Official platform constraints | verified 2026-08-21 | Primary Todoist DCR/OAuth and Chromium identity docs plus the current Todoist authorization-server metadata are linked in `docs/official-platform-notes.md`; implementation uses the metadata issuer for OAuth and the API origin for reads. |
| Provider/controller path | negative actual-use evidence | The user's real dogfood reached DCR, consent, and the extension callback, then failed during token exchange with the generic network-level message; no authenticated first GET was observed. |
| Actual Chromium use | blocked for this dispatch | Chrome exposed the unpacked extension tab, but the browser-control policy rejected direct inspection of `chrome-extension://` content. No CDP or alternate browser workaround was used, so the post-fix positive path is not claimable. |
| Standalone parity/cutover | not-ready | Token exchange and first authenticated GET still require direct live evidence. No MMCP removal or standalone cutover is authorized by this ledger. |

Tests, commits, and a clean worktree are not substitutes for provider/browser acceptance.
