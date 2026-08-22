# ADR 0006: Checkout-bound unpacked artifact provenance

Status: accepted for the 2026-08-22 actual-use reconciliation

## Context

`dist/` is ignored and generated inside the checkout that runs the build. A source push can therefore leave another checkout's apparently valid unpacked extension at an older revision. A clean build in an isolated worktree does not refresh the directory a user later loads.

## Decision

Keep `dist/` ignored, but make the local build self-identifying and self-checking. `npm run build` writes a deterministic `build-info.json` with the full invoking-checkout revision and source state, verifies the MV3 manifest and required page/service-worker entrypoints, and the loaded page displays the short revision or an explicit missing-provenance warning. README and the specification require building and loading `dist/` from the same checkout.

## Consequences

- A stale ignored directory is diagnosable without guessing which worktree built it.
- Revision/entrypoint checks catch stale or incomplete artifacts before Chromium load.
- The artifact marker is not a task store, provider source, telemetry channel, or release surface.
- Store publication, hosted release, and any distribution authority remain outside this decision.
