# 0007 — Keep `vendor-src`; workspace-root packages are `dependencies`

| Proposal                                     | Date       | Status   | Supersedes | Superseded by |
| -------------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [22](../proposals/22-tooling-ci-and-repo.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q22.3:** "yes on the workspace root but can be a deep [dep] as all things on the root should be deps not dev deps" — `vendor-src` stays, installed in the `next/` workspace root.
- **Convention:** everything in the workspace-root `package.json` (`next/package.json`) goes in `dependencies`, not `devDependencies`. The root is private and never published, so the split carries no meaning there.

## Rationale

Alex's convention. Packages under `packages/` keep the normal split, because it matters for consumers.

## Rejected alternatives

- Dropping `vendor-src` (the allow-list exception in 22).

## Parity impact

None.

## Follow-ups

- [x] `next/package.json`: `typescript`, `vendor-src` and `vite-plus` moved to `dependencies`.
- [ ] Apply the same convention to anything added to the workspace root later.
