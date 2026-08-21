# ADR 0001: Browser-native public OAuth client

Status: accepted for bootstrap

## Context

The visualization must be standalone and read-only. A browser extension cannot keep a symmetric OAuth client secret in public source, and adding a backend/native host would violate the approved boundary.

## Decision

Use Todoist's public OAuth client metadata document plus PKCE. The user supplies an HTTPS metadata URL whose declared scope is `data:read` and whose redirect URI matches Chromium's generated extension redirect. The extension calls Todoist directly and stores only short-lived OAuth session material in `chrome.storage.session`.

## Consequences

- No public client secret or application server is required.
- The user must provision/choose the metadata document and stable extension redirect outside this repository; that is a setup dependency, not public repository truth.
- OAuth actual-use remains unverified without safe local browser authority.
- Provider client registration, production hosting, and store publication are out of scope.
