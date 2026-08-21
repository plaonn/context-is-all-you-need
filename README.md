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

1. A local Context label, such as `Work` or `Personal`.
2. The Todoist section ID that bounds that Context's project roots.
3. An explicit `Connect Todoist` action.

On Connect, the extension registers or reuses its own Todoist public client for the current unpacked-extension redirect identity through `https://api.todoist.com/oauth/register`, sends consent through `https://app.todoist.com/oauth/authorize`, and exchanges/refreshes through `https://api.todoist.com/oauth/access_token`. It keeps resource reads on the Todoist API origin, requests only `data:read`, uses `chrome.identity.launchWebAuthFlow` and PKCE, and never stores or requires a client secret. The Todoist metadata issuer is recorded separately; endpoint URLs are not synthesized from it.

Todoist access and refresh credentials remain in Chrome session storage; the non-secret client registration is kept in browser-local configuration for reuse. The projected cache is also browser-local and stores only bounded viewer fields. No credential or personal task payload belongs in source control; synthetic public-safe fixtures are under `fixtures/`.

## Semantics and boundaries

The accepted Project context v1 semantics are preserved in the browser-owned core and now sit beneath a Context board: one local Context maps to one Todoist section, all discovered project roots are shown together, and each card exposes a compact connected workstream projection. Existing one-section configuration migrates locally without another OAuth registration. Project history and recent completed nodes load only when a card is expanded; compact reads, per-Context/project caches, bounded concurrency, freshness, and isolated partial failures keep the first board read bounded. When the existing bounded exception/decision fields are present, material blocked or decision attention is compactly surfaced while passive watching stays lower-salience; expansion reveals bounded resume-critical detail without inferring authority. See [docs/SPEC.md](docs/SPEC.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/decisions/0002-preserve-project-context-v1.md](docs/decisions/0002-preserve-project-context-v1.md).

The acceptance ledger separates local checks from live provider/browser evidence. It records the prior clean unpacked-extension success through DCR → consent → PKCE token exchange → authenticated first GET and baseline Project context UI without a DevTools `window.fetch` wrapper, plus synthetic multi-Context board and desktop/narrow visual evidence for this revision. The new board's authenticated provider/browser acceptance is not inferred from those baseline facts.
