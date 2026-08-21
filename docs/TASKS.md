# Task mapping

This file maps durable requirements to repository surfaces. It is not a task database and does not replace Todoist.

| Requirement | Implementation | Tests/checks | Direct evidence / status |
| --- | --- | --- | --- |
| R1 standalone read-only projection | `src/core/api.ts`, `src/extension/`, MV3 manifest | `tests/api.test.ts`, privacy scan | Satisfied 2026-08-21: clean unpacked Chromium load and Todoist readback |
| R2 Context board, v1 semantics, bounded cache, and material attention | `extension/config.ts`, `metadata.ts`, `projection.ts`, `pagination.ts`, `api.ts`, `cache.ts`, `renderer.ts` | config/projection/pagination/API/cache/renderer tests | Local multi-Context projection, compact parallel reads, bounded blocked/decision attention, passive watching, progressive detail, and freshness readback |
| R3 public privacy and least privilege | `auth.ts`, `extension/config.ts`, local/session storage, escaped renderer | auth + first-run tests, privacy scan | Satisfied 2026-08-21: clean canonical OAuth registration/consent, PKCE token exchange, authenticated data read, and UI render |
| R4 maintainable bootstrap | docs, scripts, fixtures, source boundaries | `npm run check` | Canonical revision/readback if push is authorized |

## Lifecycle

The repository contribution is `implemented`, and standalone acceptance is `ready` after the user's direct clean-path canonical OAuth token exchange, authenticated data read, and UI evidence on 2026-08-21. The Context board and bounded attention revision are locally validated; fresh provider/browser evidence for this new surface remains separate from tests and commits. No Todoist source mutation or production deployment is implied by this mapping. Attention projection is presentation-only and does not infer authority. Non-blocking UX follow-up is separate from this task.
