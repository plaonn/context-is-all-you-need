# Context Is All You Need

Context Is All You Need is a standalone Chromium Manifest V3 extension that renders a bounded, read-only projection of Todoist project context in a dedicated full browser tab.

It keeps Todoist as the canonical task and lifecycle source. The extension has no MMCP runtime dependency, no normal-use application server, no sidecar task database, no polling or scheduler, and no task mutation controls.

## Local development

```sh
npm ci
npm run check
```

`npm run build` emits an unpacked extension under `dist/`. In Chromium, open `chrome://extensions`, enable Developer mode, and load `dist/` as an unpacked extension.

## First-run setup

The extension asks for:

1. The Todoist section ID that bounds project-context roots.
2. An HTTPS Todoist OAuth client metadata URL for a public client.

The metadata document must use `token_endpoint_auth_method: "none"`, request only `data:read`, and list the extension redirect URL shown by the setup page. The flow uses `chrome.identity.launchWebAuthFlow` and PKCE; no client secret is stored in this repository or required at runtime.

Todoist credentials remain in Chrome session storage. The projected cache is also browser-local and stores only bounded viewer fields. No credential or personal task payload belongs in source control; synthetic public-safe fixtures are under `fixtures/`.

## Semantics and boundaries

The accepted MMCP Project context v1 semantics are preserved in the browser-owned core: configurable section discovery, top-level root filtering, bounded 50-item pagination, direct-child active/recent-completed reads, goal/workstream metadata, lifecycle lanes, salience suppression, presentation-only contextual lineage, and 60-second fresh / 5-minute stale-while-revalidate cache behavior. See [docs/SPEC.md](docs/SPEC.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/decisions/0001-browser-native-public-client.md](docs/decisions/0001-browser-native-public-client.md).

Actual Todoist dogfood is intentionally unverified in this public bootstrap when no safe local browser credential and authority are available. The contract-allowed fixture/auth integration path and explicit non-claim are recorded in the acceptance ledger; local tests and builds do not prove live provider behavior.
