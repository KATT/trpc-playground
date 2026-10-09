# 22 — Tooling, CI, repo layout and examples

| Status     | Area       | Depends on | oRPC parity rows |
| ---------- | ---------- | ---------- | ---------------- |
| `proposed` | repo, docs | 01, 21     | —                |

## Summary

`ideas.md` sets these constraints:

- The only dev dependencies are "Vite family stuff (vitest, oxlint, oxfmt, their monorepo tooling)", TypeScript (latest), pnpm and Effect.
- "Recreate all CI things to be a lot simpler."
- "Some precommit hook that auto-formats + runs tests on what is changed is enough."
- Markdown docs only; examples that work with linked local packages.
- Tests are mainly integration tests.

**Recommendation:**

- **Vite+** (`vite-plus`, `vp`) as the single toolchain. It bundles Vitest, Oxlint, Oxfmt, Rolldown/tsdown and Vite Task, and it provides git hooks and staged-file runs.
- TypeScript 7.
- One small CI workflow.
- A fresh repo layout on the `v12` branch.

## Today (v11)

- **Tooling:** pnpm 12.4.1, Node ^24, lerna, turbo, eslint + typescript-eslint, prettier, manypkg, tsdown 0.23, vitest 5, vite 8, TypeScript ^7.0.2. There is a `ts-api` catalog pinned to TypeScript ^6 for tools that need the JS compiler API (`@trpc/openapi`, `@trpc/upgrade`).
- **`.github/workflows`:** `main`, `lint`, `release`, `codeql-analysis`, `labeler`, `lock-issues`, `dependabot-approve`, `semantic-pr`, `subtree` (syncs examples to downstream repos), `check-skills`, `validate-skills` and `notify-intent`.
- About 35 examples, a Docusaurus site (`www/`), and `vendor-src` (with a `postinstall: vendor-src check`) for `.repos/`.
- Recent drafts: [#7348](https://github.com/trpc/trpc/pull/7348) (TS7), [#7352](https://github.com/trpc/trpc/pull/7352) (replace Lerna), [#7205](https://github.com/trpc/trpc/pull/7205) and [#7206](https://github.com/trpc/trpc/pull/7206) (oxfmt/oxlint), [#7305](https://github.com/trpc/trpc/pull/7305) (knip).

## Proposed toolchain

| Concern                  | Tool                                                                                                   | Notes                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager          | pnpm 12 (workspaces, catalogs)                                                                         | Already in use                                                                                                                                  |
| Unified CLI              | **Vite+** `vite-plus` 1.1.0 (MIT): `vp check`, `vp test`, `vp pack`, `vp run`, `vp staged`, `vp hooks` | Checked on npm 2026-10-09. One `vite.config.ts` for lint, format, tasks and staged files                                                        |
| Tests                    | Vitest 5 (via `vp test`), projects per package; `expectTypeOf` for type tests                          | No tstyche (not Vite family)                                                                                                                    |
| Lint / format            | Oxlint / Oxfmt (via `vp check`)                                                                        | Replaces eslint and prettier                                                                                                                    |
| Build                    | tsdown (via `vp pack`) with `isolatedDeclarations` (01)                                                |                                                                                                                                                 |
| Task running and caching | Vite Task (via `vp run`)                                                                               | Replaces turbo and lerna                                                                                                                        |
| Type checking            | TypeScript 7 (`tsgo`)                                                                                  | Compiler-API tooling (JSDoc checker, OpenAPI static generator) uses `oxc-parser`, or the `ts-api` TS 6 catalog until TS 7 ships a stable JS API |
| Versioning / releases    | none for now; later `pnpm publish -r` + a changelog script                                             | `ideas.md`: no releases soon                                                                                                                    |
| Vendored sources         | `vendor-src` (existing)                                                                                | **Exception to the allow-list; confirm**                                                                                                        |

## Precommit hook

```ts
// vite.config.ts (sketch; verify against Vite+ docs)
export default defineConfig({
  staged: {
    '*': 'vp check --fix',                    // format + lint (+ types?) staged files
    '*.{ts,tsx}': 'vp test related --run',    // vitest: tests related to the changed files
  },
});
```

`vp hooks` installs the git hook dispatcher, so husky, lint-staged and simple-git-hooks are not needed.

## CI (one workflow)

`.github/workflows/ci.yml` runs on push to `v12` and on PRs:

1. `pnpm install --frozen-lockfile` with a cache.
2. `vp check` (format, lint, types), with no auto-fix.
3. `vp test --run` (all Vitest projects, integration-heavy).
4. **Portability fixture:** builds `test/portability` with `declaration: true` and fails on TS2742 (01).
5. **Examples:** typecheck and build every example against `workspace:*` packages.
6. **Optional matrix:** latest Effect minor (02 (h)), plus a bundle-size budget check (02 (g)).

Every other workflow is deleted. CodeQL, labeler, release and similar can come back individually when needed.

## Repo layout on `v12`

New implementation lives under **`next/`** (own pnpm workspace), so the leftover v11 tree at the repo root is not mixed in:

```text
next/                         ← code root (cd here to work)
  packages/trpcdev/           core package (01)
  packages/tanstack-query/    @trpcdev/tanstack-query (19, later)
  examples/minimal/           …
  examples/effect/            …
  examples/next-app/          Next.js app (name is the framework, not this folder)
  examples/openapi/
  examples/realtime/
  docs/                       Markdown user docs
  test/portability/           TS2742 fixture (01)
vnext/                        proposals, decisions and agent docs (this folder)
.repos/                       vendored sources (read-only)
packages/, examples/, www/    leftover v11 — do not extend; delete when Alex says (Q22.5)
```

- Examples depend on `trpcdev: workspace:*` inside the `next/` workspace. No `subtree` syncing.
- **Open:** whether `vnext/` should be renamed later (for example `docs/internal/` or `.agents/`) once the proposals phase is over.

## Recommendation

Adopt the toolchain, hook, CI and layout above. Verify these details against Vite+'s docs during the setup commit:

- `vp check` type-checking with tsgo;
- the `staged` command semantics;
- `vp test related`.

## Questions for Alex

- **Q22.1** Vite+ (`vp`) as the single toolchain, or the individual tools (vitest, oxlint, oxfmt, tsdown) wired with pnpm scripts?
- **Q22.2** Precommit hook: format + lint + related tests on staged files via `vp staged`. Should it also typecheck?
- **Q22.3** Keep `vendor-src` as an allowed dev dependency?
- **Q22.4** The proposed example set: add or remove any?
- **Q22.5** Delete v11 code from `v12` right after 01/22 are decided, or keep it until vNext reaches parity on the basics?

## Decision

- **Q22.1:** [ ] Vite+ · [ ] individual tools
- **Q22.2:** typecheck in hook: [ ] yes · [ ] no
- **Q22.3:** [ ] yes · [ ] no
- **Q22.4:** `__________`
- **Q22.5:** [ ] delete early · [ ] keep until parity
- **Notes:**
