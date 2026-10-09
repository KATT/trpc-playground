# Spikes

Throwaway experiments that feed proposals in `../.agent-docs/proposals/`. Nothing here is public API, and nothing here should be imported by `packages/`. Each spike's method and numbers are written up in `../.agent-docs/notes/`.

Generated fixtures and build output (`generated/`, `dist/`) are gitignored; the source and scripts that produce them are committed.

| Directory           | Run (from here)                                                | Note                                                                                 |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `builder-generics/` | `pnpm typeperf [n] [runs]`                                     | [builder-generics-typeperf](../.agent-docs/notes/builder-generics-typeperf.md)       |
| `link-options/`     | `pnpm test` (root), `node link-options/bench.ts`               | [link-call-options-typing](../.agent-docs/notes/link-call-options-typing.md)         |
| `danson/`           | `pnpm test` (root), `node danson/compare.ts`                   | [danson-port-and-query-params](../.agent-docs/notes/danson-port-and-query-params.md) |
| `effect-bundle/`    | `pnpm bundle`                                                  | [effect-client-bundle-size](../.agent-docs/notes/effect-client-bundle-size.md)       |
| `returned-errors/`  | `pnpm test` (root), `node returned-errors/bench.ts [n] [runs]` | [returned-error-inference](../.agent-docs/notes/returned-error-inference.md)         |
