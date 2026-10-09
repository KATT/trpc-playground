# `next/` — tRPC vNext code root

All **implementation** for the rewrite lives here. The old v11 tree at the repo root (`packages/`, `examples/`, `www/`, …) is reference only until it is deleted.

Design docs stay in `../vnext/`. Brief: `../ideas.md`.

```text
next/
  packages/trpcdev/     core package (ideas.md: single `trpcdev` package)
  examples/             workspace-linked examples
  test/portability/     TS2742 fixture
  docs/                 Markdown user docs (later)
```

Work inside this folder (`cd next`). Use its own `pnpm-workspace.yaml`; do not add new vNext packages to the root workspace.
