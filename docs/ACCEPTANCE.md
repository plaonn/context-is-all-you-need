# Acceptance ledger

| Evidence layer | Current state | Notes |
| --- | --- | --- |
| Public-safe extraction | complete | Semantics reimplemented from read-only MMCP reference inspection; no private payload copied. |
| Local implementation | complete | `npm run check` passed: typecheck, 24 tests, MV3 build, and public-safety scan; DCR persistence/reuse, redirect drift, failure handling, PKCE, refresh-token rotation, disconnect, client-mismatch recovery, and first-run field coverage are synthetic-tested. |
| Hosted CI workflow | intentionally omitted | The approved task requires build/test tooling and direct validation, not GitHub Actions; `npm run check` is the canonical validation surface. |
| Official platform constraints | verified 2026-08-21 | Primary Todoist DCR/OAuth and Chromium identity docs are linked in `docs/official-platform-notes.md`; current implementation uses the documented public `none` client contract. |
| Provider/controller path | unverified | No Todoist credential or client registration was used. |
| Actual Chromium use | unverified | No safe local browser authority was available in this dispatch. |
| Standalone parity/cutover | ready for bootstrap handoff | The first-run DCR migration is locally complete; live provider registration, consent, and browser readback remain explicitly unclaimed because no safe local authority was used. |

Tests, commits, and a clean worktree are not substitutes for provider/browser acceptance.
