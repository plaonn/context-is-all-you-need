# Decision 0003: Local validation without hosted CI

## Context

The approved standalone bootstrap requires maintainable build/test tooling and direct validation. The Todoist contract does not require GitHub Actions or another hosted CI service. A workflow file would also require a broader GitHub OAuth scope for this public repository's push path.

## Decision

Keep `npm run check` as the canonical validation command and omit `.github/workflows/ci.yml`. Preserve the TypeScript checks, tests, unpacked MV3 build, public-safety scan, fixtures, and package lock in the repository.

This is a repository-local implementation choice, not a change to the standalone product's read-only, public-safe, browser-native contract. No credential scope expansion, backend, provider write, or external service is introduced.

## Consequences

- Local validation remains reproducible from a clean checkout with `npm ci` followed by `npm run check`.
- Pushes do not require GitHub's workflow-scoped OAuth permission.
- Provider/browser actual-use acceptance remains a separate evidence layer and is not implied by local checks.

## Revisit condition

Add hosted automation only under a separately authorized repository policy or requirement; it is not needed for this bootstrap closure.
