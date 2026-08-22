# Task mapping

This file maps durable requirements to repository surfaces. It is not a task database and does not replace Todoist.

| Requirement | Implementation | Tests/checks | Direct evidence / status |
| --- | --- | --- | --- |
| R1 standalone read-only projection | `src/core/api.ts`, `src/extension/`, MV3 manifest | `tests/api.test.ts`, privacy scan | Satisfied 2026-08-21: clean unpacked Chromium load and Todoist readback |
| R2 Context matrix, v1 semantics, bounded cache, Objectives, and material attention | `extension/config.ts`, `metadata.ts`, `projection.ts`, `pagination.ts`, `api.ts`, `cache.ts`, `renderer.ts`, `extension/styles.css` | config/projection/pagination/API/cache/renderer/layout tests | Reconciliation in progress: the repaired surface must combine shared NOW/project columns with content-sized spatial node-link lineage, enclosing registered Objective regions, compact parallel reads, bounded attention, progressive detail, and freshness readback |
| R3 public privacy and least privilege | `auth.ts`, `extension/config.ts`, local/session storage, escaped renderer | auth + first-run tests, privacy scan | Satisfied 2026-08-21: clean canonical OAuth registration/consent, PKCE token exchange, authenticated data read, and UI render |
| R4 maintainable bootstrap | docs, scripts, fixtures, source boundaries | `npm run check` | Canonical revision/readback if push is authorized |
| R5 identifiable unpacked artifact | `scripts/build.mjs`, `scripts/verify-build.mjs`, `extension/index.html`, `src/extension/app.ts` | build-provenance regression tests, `npm run build`, `npm run verify:build` | Local marker/entrypoint verification; canonical ignored `dist/` rebuild and Chromium readback remain separate evidence |

## Lifecycle

The repository contribution for the first matrix pass was locally validated, but the task-local closure was superseded by the 2026-08-22 actual-use reconciliation comment. This workstream remains open until the production renderer shows compact spatial branch/merge paths, Objective regions that enclose their member blocks, and sparse-project collapse, followed by synthetic wide/narrow QA and fresh real-browser evidence. No Todoist source mutation or production deployment is implied by this mapping. Objective and attention projections are presentation-only and do not infer authority.
