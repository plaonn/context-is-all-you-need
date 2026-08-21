# ADR 0001: Browser-native public OAuth client

Status: accepted for bootstrap

## Context

The visualization must be standalone and read-only. A browser extension cannot keep a symmetric OAuth client secret in public source, and adding a backend/native host would violate the approved boundary.

## Decision

Use Todoist's unauthenticated Dynamic Client Registration endpoint to create a public client on explicit Connect, then use that client with PKCE. The registration requests only `data:read`, includes the authorization-code and refresh-token grants, uses `response_types: ["code"]` and `token_endpoint_auth_method: "none"`, and is bound to Chromium's generated extension redirect. The extension calls Todoist directly, stores only non-secret registration metadata in `chrome.storage.local`, and stores access/refresh session material in `chrome.storage.session`.

Todoist's OAuth Client ID Metadata Document flow remains a supported alternative platform capability, but is not required or exposed by normal first-run setup.

## Consequences

- No public client secret, user-hosted metadata document, or application server is required.
- An unpacked extension identity change produces a new bounded registration on the next explicit Connect; the old registration is never silently reused for the new redirect identity.
- OAuth actual-use remains unverified without safe local browser authority.
- Provider client registration, production hosting, and store publication are out of scope.
