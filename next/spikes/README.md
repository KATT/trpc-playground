# Spikes

Throwaway experiments that feed proposals in `../../vnext/proposals/`. Nothing here is public API, and nothing here should be imported by `packages/`. Each spike's method and numbers are written up in `../../vnext/notes/`.

Generated fixtures and build output (`generated/`, `dist/`) are gitignored; the source and scripts that produce them are committed.

| Directory           | Run (from here)                                                | Note                                                                              |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `builder-generics/` | `pnpm typeperf [n] [runs]`                                     | [builder-generics-typeperf](../../vnext/notes/builder-generics-typeperf.md)       |
| `link-options/`     | `pnpm test` (root), `node link-options/bench.ts`               | [link-call-options-typing](../../vnext/notes/link-call-options-typing.md)         |
| `danson/`           | `pnpm test` (root), `node danson/compare.ts`                   | [danson-port-and-query-params](../../vnext/notes/danson-port-and-query-params.md) |
| `effect-bundle/`    | `pnpm bundle`                                                  | [effect-client-bundle-size](../../vnext/notes/effect-client-bundle-size.md)       |
| `returned-errors/`  | `pnpm test` (root), `node returned-errors/bench.ts [n] [runs]` | [returned-error-inference](../../vnext/notes/returned-error-inference.md)         |
