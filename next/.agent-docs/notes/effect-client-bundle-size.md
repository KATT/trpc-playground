# Minimal Effect client bundle size

- **Date:** 2026-10-09
- **Question:** What does a browser client built on Effect cost, compared with the v11 client, and which pieces drive the size? This is the "first spike" that 02 (g) wants before setting a budget.
- **Feeds:** [02 — Effect integration model](../proposals/02-effect-integration.md) (g) bundle size and (f) Effect client; [11](../proposals/11-serialization-and-files.md) (danSON port cost); [14](../proposals/14-subscriptions-and-streaming.md) (SSE on `Stream`).
- **Code:** [`next/spikes/effect-bundle/`](../../spikes/effect-bundle/). Run `pnpm bundle` in `next/spikes`; `node effect-bundle/diff-modules.ts <a> <b>` shows which modules one fixture adds over another.

## Method

- **Bundler:** `rolldown@1.2.13` (the one Vite+ ships), ESM, `platform: 'browser'`, tree-shaken, `minify: true` (oxc), `process.env.NODE_ENV = "production"`. Sizes are min, min+gzip (level 9, as in Effect's `packages/tools/bundle`) and min+brotli (quality 11). Results are deterministic across runs.
- **Minifier check:** re-minifying the same rolldown output with terser 5 (what Effect's tool uses) changes min+gzip by ≤ 4% (`effect-basic` 7.17 → 6.95 KB, `client-effect-full` 23.69 → 23.34 KB). The oxc numbers below can be compared with Effect's.
- **Versions:** `effect@4.0.2`, `@trpc/client@11.19.0`, `superjson@2.2.6`, `danson@0.13.1`, Node 24.21.
- **Client sketches** (`sketch/promise.ts`, `sketch/effect.ts`) are **size proxies, not API proposals**: a proxy that records the path, a link chain, a `fetch` terminal and a typed error, and optional retry/timeout, SSE subscriptions and a pluggable codec. The Effect sketch is the same logic on `Effect`/`Stream`, with a Promise surface (`Effect.runPromise(…, { signal })`) and an Effect surface (procedures return `Effect`). Neither batches, so they understate a real client; the v11 rows include batching.

## Results

All sizes are KB (1024 bytes).

**Calibration (Effect's own fixtures):**

| fixture                                    |   min | min+gzip | min+brotli |
| ------------------------------------------ | ----: | -------: | ---------: |
| `effect-basic` (`succeed` + `runFork`)     | 20.61 |     7.17 |       6.63 |
| `effect-stream` (`range` + `runDrain`)     | 29.63 |    10.09 |       9.29 |
| `effect-schema` (Effect's `schema.ts`)     | 70.41 |    22.38 |      20.38 |
| `effect-http-client` (`effect/http` fetch) | 70.08 |    22.59 |      20.46 |

`MIGRATION.md` quotes ~6.3 KB minimal and ~15 KB with Schema. On 4.0.2 the minimal program reproduces (6.95 KB with terser), but **Schema does not: 22.4 KB** with either minifier. Schema also drags in `effect/http/Cookies`, `BigDecimal` and `DateTime`, because its built-in schemas don't tree-shake.

**Clients:**

| fixture                                                             |   min | min+gzip | min+brotli |
| ------------------------------------------------------------------- | ----: | -------: | ---------: |
| `client-promise` (no Effect, JSON)                                  |  0.95 |     0.59 |       0.48 |
| `client-promise-retry`                                              |  1.10 |     0.66 |       0.54 |
| `trpc-v11-client` (`httpBatchLink`)                                 | 16.11 |     5.73 |       5.12 |
| `trpc-v11-client-full` (retry, split, batch-stream, SSE, superjson) | 39.54 |    12.90 |      11.61 |
| `client-effect` (Effect surface, JSON)                              | 25.00 |     8.76 |       8.05 |
| `client-effect-promise` (Promise surface on Effect, JSON)           | 25.03 |     8.77 |       8.06 |
| `client-effect-danson` (+ danSON sync codec)                        | 29.54 |    10.30 |       9.46 |
| `client-effect-retry` (+ `Effect.retry` + `Effect.timeout`)         | 39.61 |    13.23 |      12.11 |
| `client-effect-sse` (+ SSE via `Stream`, `toAsyncIterable`)         | 46.72 |    15.83 |      14.54 |
| `client-effect-full-sync-only` (retry + SSE + danSON sync)          | 56.78 |    19.09 |      17.49 |
| `client-effect-full` (+ danSON streaming responses)                 | 71.57 |    23.69 |      21.55 |

**Serializers alone:**

| fixture                                      |   min | min+gzip | min+brotli |
| -------------------------------------------- | ----: | -------: | ---------: |
| `danson-port-sync` (port, `std` types)       |  4.47 |     1.81 |       1.67 |
| `danson-npm-sync` (`danson@0.13.1`)          |  5.12 |     2.02 |       1.85 |
| `danson-port-stream` (port, Effect `Stream`) | 69.26 |    22.87 |      20.83 |
| `danson-npm-async` (`danson@0.13.1`)         |  9.32 |     3.42 |       3.16 |
| `superjson`                                  | 11.01 |     3.87 |       3.54 |

**Apps that already ship Effect:**

| fixture                                                          |    min | min+gzip | min+brotli |
| ---------------------------------------------------------------- | -----: | -------: | ---------: |
| `app-effect` (gen, Schema, light `Stream`, `Schedule` retry)     |  86.50 |    27.70 |      25.06 |
| `app-effect-with-client` (+ Effect-surface `client-effect-full`) | 109.87 |    35.57 |      31.92 |

## Findings

1. **The floor is Effect's runtime, not tRPC code.** The Effect client's own code is ~1.6 KB min+gzip on top of the 7.2 KB runtime (`effect-basic`). The Promise and Effect surfaces cost the same (8.77 vs 8.76 KB): `runPromise` is in the core.
2. **Promise users pay about +3 KB for the smallest client** (8.8 KB vs v11's 5.7 KB with batching). Without batching the comparison flatters Effect, so the real gap is likely somewhat larger.
3. **Each Effect feature module has a step cost.** Measured over the 8.8 KB base: `Effect.retry` + `Effect.timeout` +4.5 KB (`Schedule`, `Duration`), SSE on `Stream` +7.1 KB (`Stream`, `Channel`, `Pull`, `Scope`), danSON sync codec +1.5 KB. The steps overlap, so the combined `client-effect-full-sync-only` is 19.1 KB, not the sum.
4. **A full Promise client is ~1.8× v11** (23.7 KB vs 12.9 KB, +10.8 KB). That is the number to compare when "Effect inside, Promise outside" is weighed against shipping a Promise-native client core.
5. **The streaming danSON port is the most expensive single piece.** It adds 4.6 KB over the sync-only full client and 22.9 KB standalone, versus 3.4 KB for `danson-npm-async`. Most of it is `Queue`, plus `Semaphore`, `MutableList`, `Deferred`, `Latch` and a bigger `Channel`, which come from the per-index queues and the dispatcher fiber in `deserializeStream`. Two levers to try if this matters: deserialize with `Stream.callback` emitters instead of `Queue`, or keep the deserializer's async half on plain Promises/`ReadableStream` (that code is small and has no Effect dependency) while the server side stays on `Stream`.
6. **Apps that already use Effect pay ~7.9 KB** for the full client (`app-effect` → `app-effect-with-client`). That covers the extra `Stream`/`Channel` surface, `Queue` from streaming danSON, danSON itself and the client code. A light `Stream` user doesn't already have most of the `Stream` modules.
7. **Keep Schema and `effect/http` off the default client path**, as 02 (g) says. Each costs ~22 KB on its own, about as much as the whole full client sketch. The sketches use only `fetch`, `Data.TaggedError`, `Effect` and `Stream`.
8. **What a measurement can and can't catch:** module-level DCE is good. Moving `Stream.toAsyncIterable` from the Promise client into an opt-in adapter took `client-effect-promise` from 13.9 KB to 8.8 KB, because the bundler can't prove that an unused branch inside a reachable function is dead. Feature code has to sit behind separate imports (links, adapters), not runtime flags, for it to shake out.

## Candidate budgets (input for 02 (g), not a decision)

If the bundle fixture in CI is adopted, these numbers suggest a shape (min+gzip, measured with this script):

- Promise client, JSON, no subscriptions: ≤ 10 KB (today's sketch 8.8 KB).
- Promise client with retry, SSE and danSON: ≤ 25 KB (today's sketch 23.7 KB), with a separate row tracking the streaming-serializer cost.
- Effect surface: tracked as a delta over a fixed `app-effect` baseline (≈ 8 KB today).

## Not covered

- Batching, `httpBatchStreamLink`-style framing and WebSocket links. The sketches are smaller than a real client.
- Server bundle size (only matters for edge workers; not measured).
- How React Query/TanStack bindings add on top.
