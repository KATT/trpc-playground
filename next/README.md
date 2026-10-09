# `next/` — tRPC vNext code root

All **implementation** for the rewrite lives here. The old v11 tree at the repo root (`packages/`, `examples/`, `www/`, …) is reference only until it is deleted.

Design docs stay in `../vnext/`. Brief: `../ideas.md`.

```text
next/
  packages/trpcdev/     core package (ideas.md: single `trpcdev` package)
  examples/             workspace-linked examples
  test/portability/     TS2742/TS2883 fixture
  spikes/               throwaway experiments; results in ../vnext/notes/
  docs/                 Markdown user docs (later)
```

Work inside this folder (`cd next`). Use its own `pnpm-workspace.yaml`; do not add new vNext packages to the root workspace.

## Tooling

[Vite+](https://viteplus.dev) (`vite-plus`, CLI `vp`) bundles Vitest, Oxlint, Oxfmt and tsdown. Config lives in `vite.config.ts`. Requires Node ≥ 24.11.

Node is pinned in `.nvmrc` (`24.21.0`, same version as the repo root). From this directory, `nvm use` selects it even when `next/` is the workspace root. Then:

```bash
nvm use
pnpm install
pnpm test
```

| Command          | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| `pnpm install`   | Installs deps; `prepare` installs the git hook dispatcher     |
| `pnpm typecheck` | `tsc --noEmit` (TypeScript 7) in every workspace package      |
| `pnpm check`     | `vp check`: format check, lint and type-aware lint/type check |
| `pnpm fix`       | `vp check --fix`: format and autofix                          |
| `pnpm test`      | `vp test run`: Vitest, including `*.test-d.ts` type tests     |

**Pre-commit:** `.vite-hooks/pre-commit` runs `vp staged` (see `staged` in `vite.config.ts`): `vp check --fix` on staged files under `next/`, plus `vp test related` for staged `.ts` files. `pnpm install` enables it via `vp config` unless `core.hooksPath` is already set to something else. Skip once with `VP_GIT_HOOKS=0 git commit …`.

**CI:** `../.github/workflows/next.yml` runs `typecheck`, `check` and `test` for changes under `next/`. Root v11 workflows are untouched.
