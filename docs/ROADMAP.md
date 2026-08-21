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

## Reserved future decisions

- Stable extension key/redirect provisioning or explicit use of Todoist's alternative hosted metadata-document flow.
- Store publication, production launch, user analytics, additional Todoist scopes, or any provider write.
- Cross-repository integration or changes to MMCP.
