# Project-local instructions

- Keep this repository public-safe. Never add credentials, tokens, private task payloads, personal history, private absolute paths, runtime databases, browser profiles, or copied MMCP private material.
- Todoist remains the canonical source for tasks and lifecycle. The extension is read-only: do not add task writes, sidecar task storage, global planning, notifications, polling, schedulers, or automatic wake.
- Keep the browser client independent of MMCP and application servers during normal use. Provider integration belongs behind the small read-only adapter in `src/core/api.ts`.
- Use synthetic fixtures for tests. Distinguish local evidence from provider/browser dogfood evidence; a green suite or commit does not prove external acceptance.
- OAuth must remain a public PKCE client with Todoist `data:read` only. Never add a client secret to source, build output, or browser storage.
- Before changing Todoist endpoint details, refresh the primary official Todoist API and Chromium extension documentation and update `docs/official-platform-notes.md`.
