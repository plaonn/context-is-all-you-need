# Acceptance ledger

| Evidence layer | Current state | Notes |
| --- | --- | --- |
| Public-safe extraction | complete | Semantics reimplemented from read-only MMCP reference inspection; no private payload copied. |
| Local implementation | complete for this revision | `npm run check` passed: typecheck, 31 tests, MV3 build, and public-safety scan; canonical endpoint identity, stale-registration invalidation, PKCE token exchange, receiver-neutral fetch transport, sanitized network/HTTP OAuth diagnostics, refresh-token retention, and read-only boundaries are synthetic-tested. |
| Hosted CI workflow | intentionally omitted | The approved task requires build/test tooling and direct validation, not GitHub Actions; `npm run check` is the canonical validation surface. |
| Official platform constraints | verified 2026-08-21 | Primary Todoist DCR/OAuth and Chromium identity docs plus the current Todoist authorization-server metadata are linked in `docs/official-platform-notes.md`; issuer provenance is separated from the concrete API/consent/token endpoint contract. |
| Provider/controller path | clean actual-use acceptance | After reloading the `5ad05bc` extension without the DevTools fetch wrapper, the user's real DCR → consent → callback → PKCE exchange and authenticated Todoist data reads succeeded. The project-context UI rendered normally. This is direct user-provided clean-path evidence that the provider/API route and first authenticated read work. |
| Actual Chromium use | accepted | The user verified the unpacked extension clean path without monkeypatching: OAuth/DCR/PKCE, authenticated data reads, and project-context UI all worked. Direct Codex inspection of `chrome-extension://` content remains unavailable, but is not needed to replace the user's direct acceptance evidence. |
| Standalone parity/cutover | ready | Functional Requirement is satisfied and standalone cutover is ready. The prior MMCP-removal hold from this task is released by this clean-path acceptance; any removal remains a separate authorized workstream. |
| UX follow-up | separate product follow-up | Non-blocking UX improvements remain outside this implementation task and must not reopen or weaken the satisfied functional Requirement. |

Tests, commits, and a clean worktree are not substitutes for provider/browser acceptance.
