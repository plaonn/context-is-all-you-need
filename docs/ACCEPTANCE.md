# Acceptance ledger

| Evidence layer | Current state | Notes |
| --- | --- | --- |
| Public-safe extraction | complete | Semantics reimplemented from read-only MMCP reference inspection; no private payload copied. |
| Local implementation | complete | `npm run check` passed: typecheck, 14 tests, MV3 build, and public-safety scan. |
| Official platform constraints | verified 2026-08-21 | Primary Todoist and Chromium docs are linked in `docs/official-platform-notes.md`. |
| Provider/controller path | unverified | No Todoist credential or client registration was used. |
| Actual Chromium use | unverified | No safe local browser authority was available in this dispatch. |
| Standalone parity/cutover | not-ready | Local contribution is present; direct provider/browser evidence is still required. |

Tests, commits, and a clean worktree are not substitutes for provider/browser acceptance.
