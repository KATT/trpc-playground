# 0004 — `effect` is a regular dependency; integrations are `@trpcdev/*`

| Proposal                                               | Date       | Status   | Supersedes | Superseded by |
| ------------------------------------------------------ | ---------- | -------- | ---------- | ------------- |
| [01](../proposals/01-packages-and-type-portability.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q1.1:** "can be a dependency instead on ^4.0.0" — `trpcdev` depends on `effect` as a regular dependency, range `^4.0.0`. This differs from the recommendation (peer dependency).
- **Q1.3:** "yes" — integration packages are scoped: `@trpcdev/tanstack-query`, `@trpcdev/next`, …

```json
// packages/trpcdev/package.json
{ "dependencies": { "effect": "^4.0.0" } }
```

## Rationale

A regular dependency means nothing for Promise users to think about, and no peer warnings. With a caret range, package managers dedupe against an app's own `effect@4.x`.

What we give up: if an app's `effect` is outside `^4.0.0` (for example a future v5), it gets a second copy, and values that cross between the copies (Effects, Schemas, service keys) may not interoperate. Peer dependencies would have surfaced that as an install-time conflict instead.

## Rejected alternatives

- Peer dependency `^4` (recommended in 01): an extra install step on package managers that don't auto-install peers, for every user, to protect the minority who mix majors.
- Unscoped `trpcdev-*` names.

## Parity impact

None.

## Follow-ups

- [x] `packages/trpcdev/package.json`: `effect` moved from `peerDependencies` to `dependencies` (`^4.0.0`).
- [x] 02 (h) version policy noted as superseded by this decision on the dependency type.
- [ ] Add a CI check (02 (h)) that the latest `effect@4` minor still works, since users get whatever `^4.0.0` resolves to.
