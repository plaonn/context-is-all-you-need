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
2. An explicit `Connect Todoist` action.

On Connect, the extension registers or reuses its own Todoist public client for the current unpacked-extension redirect identity through `https://api.todoist.com/oauth/register`, sends consent through `https://app.todoist.com/oauth/authorize`, and exchanges/refreshes through `https://api.todoist.com/oauth/access_token`. It keeps resource reads on the Todoist API origin, requests only `data:read`, uses `chrome.identity.launchWebAuthFlow` and PKCE, and never stores or requires a client secret. The Todoist metadata issuer is recorded separately; endpoint URLs are not synthesized from it.

Todoist access and refresh credentials remain in Chrome session storage; the non-secret client registration is kept in browser-local configuration for reuse. The projected cache is also browser-local and stores only bounded viewer fields. No credential or personal task payload belongs in source control; synthetic public-safe fixtures are under `fixtures/`.

## Semantics and boundaries

The accepted MMCP Project context v1 semantics are preserved in the browser-owned core: configurable section discovery, top-level root filtering, bounded 50-item pagination, direct-child active/recent-completed reads, goal/workstream metadata, lifecycle lanes, salience suppression, presentation-only contextual lineage, and 60-second fresh / 5-minute stale-while-revalidate cache behavior. See [docs/SPEC.md](docs/SPEC.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/decisions/0001-browser-native-public-client.md](docs/decisions/0001-browser-native-public-client.md).

The acceptance ledger separates local checks from live provider/browser evidence. The current ledger records a negative dogfood result at token exchange and keeps standalone parity/cutover `not-ready` until a post-fix DCR → consent → PKCE token exchange → authenticated first GET is directly observed.
