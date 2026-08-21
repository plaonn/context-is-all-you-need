# ADR 0001: Browser-native public OAuth client

Status: accepted for bootstrap

## Context

The visualization must be standalone and read-only. A browser extension cannot keep a symmetric OAuth client secret in public source, and adding a backend/native host would violate the approved boundary.

## Decision

Use Todoist's unauthenticated Dynamic Client Registration endpoint to create a public client on explicit Connect, then use that client with PKCE. Current authorization-server metadata identifies `https://todoist.com` as the issuer and advertises DCR, authorization, and token endpoints under that origin; the extension keeps the resource API at `https://api.todoist.com/api/v1/`. The registration requests only `data:read`, includes the authorization-code and refresh-token grants, uses `response_types: ["code"]` and `token_endpoint_auth_method: "none"`, and is bound to Chromium's generated extension redirect. The extension calls Todoist directly, stores only non-secret registration metadata in `chrome.storage.local`, and stores access/refresh session material in `chrome.storage.session`. Registration schema version 2 rejects older or differently bound metadata, forcing safe re-registration rather than reusing a stale client identity.

Todoist's OAuth Client ID Metadata Document flow remains a supported alternative platform capability, but is not required or exposed by normal first-run setup.

## Consequences

- No public client secret, user-hosted metadata document, or application server is required.
- An unpacked extension identity change produces a new bounded registration on the next explicit Connect; the old registration is never silently reused for the new redirect identity.
- Token fetch rejection, HTTP OAuth error, callback redirect/error, and client-registration mismatch remain separate sanitized diagnostics.
- The acceptance ledger records prior negative dogfood at token exchange; post-fix positive browser acceptance remains unresolved until an authenticated first GET is directly observed.
- Provider client registration, production hosting, and store publication are out of scope.
