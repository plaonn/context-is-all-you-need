# Task mapping

This file maps durable requirements to repository surfaces. It is not a task database and does not replace Todoist.

| Requirement | Implementation | Tests/checks | Direct evidence still needed |
| --- | --- | --- | --- |
| R1 standalone read-only projection | `src/core/api.ts`, `src/extension/`, MV3 manifest | `tests/api.test.ts`, privacy scan | Authorized Chromium load and Todoist readback |
| R2 v1 semantics and bounded cache | `metadata.ts`, `projection.ts`, `pagination.ts`, `cache.ts`, `renderer.ts` | projection/pagination/cache/renderer tests | Bounded live UI behavior and freshness readback |
| R3 public privacy and least privilege | `auth.ts`, `extension/config.ts`, local/session storage, escaped renderer | auth + first-run tests, privacy scan | Safe OAuth registration/consent and provider scope readback |
| R4 maintainable bootstrap | docs, scripts, fixtures, source boundaries | `npm run check` | Canonical revision/readback if push is authorized |

## Lifecycle

The repository contribution is `implemented` after local validation, and the bootstrap Requirement is `satisfied` through the contract-allowed fixture/auth integration path. Provider/browser actual-use remains unverified and explicitly unclaimed. No Todoist or production mutation is implied by this mapping.
