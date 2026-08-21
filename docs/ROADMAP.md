# Roadmap

## Bootstrap complete

- Extract public-safe Project context v1 semantics from the accepted MMCP prototype.
- Establish the standalone MV3 page/action, GET-only Todoist adapter, PKCE auth seam, cache, renderer, fixtures, tests, and privacy scan.
- Document browser/provider boundaries and preserve actual-use evidence as separate from local delivery.

## Next bounded validation

- Load the unpacked extension in an authorized local Chromium profile.
- Use a read-only Todoist account authority through the extension's Dynamic Client Registration flow.
- Verify canonical `todoist.com` DCR/consent/PKCE token exchange, authenticated first GET from `api.todoist.com`, section discovery, selected projection, cache freshness transitions, canonical links, and absence of controls that mutate source.
- Record provider/browser evidence and reconcile whether standalone parity/cutover is `ready` or `not-ready`.

Until that live token and first-GET evidence exists, standalone parity/cutover remains `not-ready`; MMCP removal is out of scope.

## Reserved future decisions

- Stable extension key/redirect provisioning or explicit use of Todoist's alternative hosted metadata-document flow.
- Store publication, production launch, user analytics, additional Todoist scopes, or any provider write.
- Cross-repository integration or changes to MMCP.
