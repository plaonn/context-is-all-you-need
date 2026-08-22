# Roadmap

## Bootstrap complete

- Extract public-safe Project context v1 semantics from the accepted MMCP prototype.
- Establish the standalone MV3 page/action, GET-only Todoist adapter, PKCE auth seam, cache, renderer, fixtures, tests, and privacy scan.
- Document browser/provider boundaries and preserve actual-use evidence as separate from local delivery.

## Standalone acceptance — complete 2026-08-21

- The user reloaded the unpacked extension and verified the clean read-only Todoist DCR/consent/PKCE route without a DevTools fetch wrapper.
- Authenticated Todoist data reads and the project-context UI rendered successfully.
- Functional Requirement is satisfied and standalone parity/cutover is `ready`; the MMCP-removal hold from this task is released.
- Non-blocking UX improvements are recorded as a separate product follow-up, outside this task's closure.

Further UX work, if desired, is not a prerequisite for this functional acceptance.

## Context recovery matrix — actual-use spatial reconciliation 2026-08-22

- Replace the single Project selector with local Context mappings and a selected-Context matrix.
- Show all selected-Context project roots as compact horizontal coordinate lanes in one unified Context graph plane with one global semantic Y-axis; the actual NOW rule runs through current nodes, and bounded past/near-future depth is shared across lanes. Transpose lanes vertically on narrow layouts.
- Group only explicitly registered short-term Objectives and render one enclosure spanning their member nodes across each continuous project graph; draw visible branch/merge paths only from explicit Context Predecessor edges; Workstream remains optional metadata rather than the primary layout axis.
- Surface material blocked/decision attention compactly, keep passive watching lower-salience, and reveal bounded resume-critical fields only on expansion without inferring authority.
- Keep completed/deep history behind per-project expansion, with per-Context/project cache, bounded compact concurrency, and isolated partial failures; advance the cache envelope/key version so stale pre-matrix snapshots are not misread.
- Preserve the Project context v1 projection and read-only `data:read` boundary; fresh provider/browser dogfood of this new surface remains a separate evidence layer.
- The initial structural implementation was reopened by actual-use evidence because fixed empty bands, footer-only lineage, and detached Objective summaries did not satisfy the spatial recovery model. The local reconciliation now covers the unified plane and synthetic visual invariants; fresh real-browser dogfood remains a separate evidence layer.

## Unpacked artifact freshness — implemented locally 2026-08-22

- Reconcile checkout-local ignored `dist/` freshness with a deterministic full-revision marker and generated MV3 entrypoint verification.
- Show loaded artifact provenance in the extension header and document the same-checkout build/load flow.
- Keep direct Chromium startup/read acceptance separate from local build and test evidence.

## Reserved future decisions

- Stable extension key/redirect provisioning or explicit use of Todoist's alternative hosted metadata-document flow.
- Store publication, production launch, user analytics, additional Todoist scopes, or any provider write.
- Cross-repository integration or changes to MMCP.
