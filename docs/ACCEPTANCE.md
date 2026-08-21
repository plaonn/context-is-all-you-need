# Acceptance ledger

| Evidence layer | Current state | Notes |
| --- | --- | --- |
| Public-safe extraction | complete | Semantics reimplemented from read-only MMCP reference inspection; no private payload copied. |
| Local implementation | complete | `npm run check` passed: typecheck, 14 tests, MV3 build, and public-safety scan. |
| Hosted CI workflow | intentionally omitted | The approved task requires build/test tooling and direct validation, not GitHub Actions; `npm run check` is the canonical validation surface. |
| Official platform constraints | verified 2026-08-21 | Primary Todoist and Chromium docs are linked in `docs/official-platform-notes.md`. |
| Provider/controller path | unverified | No Todoist credential or client registration was used. |
| Actual Chromium use | unverified | No safe local browser authority was available in this dispatch. |
| Standalone parity/cutover | ready for bootstrap handoff | The contract-allowed fixture/auth integration path is complete and live provider/browser use is explicitly unclaimed; this revision is ready for the next standalone-owner step. |

Tests, commits, and a clean worktree are not substitutes for provider/browser acceptance.
