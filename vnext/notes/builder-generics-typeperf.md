# Options-bag builder generic vs positional generics (type performance)

- **Date:** 2026-10-09
- **Question:** Does one options-bag type parameter (03 (b) G-A) cost noticeably more type-checking than positional generics (G-B) on a ~1k-procedure router?
- **Feeds:** [03 — Builder and init](../proposals/03-builder-and-init.md) (Q3.2)
- **Code:** [`next/spikes/builder-generics/`](../../next/spikes/builder-generics/)

## Method

Three type-only builders with identical behaviour and 8 state slots (`ctx`, `meta`, `ctxOverrides`, `inputIn`, `inputOut`, `outputIn`, `outputOut`, `errors`). Methods: `input` (chainable, merges), `output`, `meta`, `use` (adds context), `query`, `mutation`.

| Variant         | State threading                                                                         |
| --------------- | --------------------------------------------------------------------------------------- |
| `positional`    | `ProcedureBuilder<TContext, TMeta, …, TErrors>` (v11 style)                             |
| `bag-intersect` | `ProcedureBuilder<TDef>`; methods return `ProcedureBuilder<Omit<TDef, keyof P> & P>` (#6027) |
| `bag-mapped`    | `ProcedureBuilder<TDef>`; methods return a flat `{ [K in keyof BuilderDef]: K extends keyof P ? P[K] : TDef[K] }` |

`generate.ts` writes, per variant, `n` procedures in files of 10 (5 shapes rotating: bare query; input + query; `authed` middleware + input + mutation; two chained inputs + output; two context-adding middlewares + meta), a root router object, and a `client.ts` that calls every procedure through a mapped client type and assigns each result to an annotated variable (so inference is verified, not just computed). Every procedure has unique field names so instantiations cannot be shared.

`bench.ts` runs `tsc -p … --extendedDiagnostics --singleThreaded` (declaration emit on) 5 times per variant and reports medians.

```sh
cd next/spikes && node builder-generics/bench.ts 1000 5
```

Environment: TypeScript 7.0.2 (`tsc` = tsgo), Node 24.21, 4-vCPU Xeon VM, `--singleThreaded`.

## Results

Whole program (builder + router + client), medians of 5:

| variant       | procedures |  types | instantiations | memory |  check | total | `.d.ts` (routers) |
| ------------- | ---------: | -----: | -------------: | -----: | -----: | ----: | ----------------: |
| positional    |       1000 | 46 729 |        198 995 |  71 MB | 0.247s | 0.44s |            342 KB |
| bag-intersect |       1000 | 49 880 |        298 406 |  74 MB | 0.293s | 0.51s |            544 KB |
| bag-mapped    |       1000 | 50 812 |        323 588 |  75 MB | 0.308s | 0.53s |            538 KB |
| positional    |       2000 | 92 809 |        396 995 | 118 MB | 0.617s | 1.03s |            688 KB |
| bag-intersect |       2000 | 98 960 |        595 306 | 124 MB | 0.738s | 1.22s |           1091 KB |
| bag-mapped    |       2000 |100 692 |        645 688 | 127 MB | 0.765s | 1.28s |           1079 KB |

Builder and router only (`client.ts` excluded), 1000 procedures, 3 runs:

| variant       | instantiations | check         |
| ------------- | -------------: | ------------- |
| positional    |        151 310 | 0.16–0.19s    |
| bag-intersect |        203 078 | 0.19–0.20s    |
| bag-mapped    |        217 448 | 0.19–0.21s    |

## Findings

1. **Both bag variants scale linearly** (2× procedures ≈ 2× everything). No blow-up, no "excessively deep" errors.
2. **Cost:** bags add ~35–45% instantiations in the builder chain and ~2× in the mapped client type, which is **+15–25% check time** overall (+50–60 ms per 1k procedures on this machine). Memory is within 5%.
3. The client-side overhead is **not** the `TDef['…']` index lookups: inferring the slots directly (`Procedure<{ type: infer T; input: infer I; … }>`) saved only 2% (323 588 → 315 988 instantiations). A likely cause, not verified, is that matching `Procedure<{…}>` compares the def object structurally, while positional `Procedure<A, B, C, D>` can use the type-argument variance shortcut.
4. **Declarations / hovers** (from emitted `.d.ts`):
   - `positional`: `ProcedureBuilder<Context, Meta, Overwrite<object, { user: … }>, typeof unset, typeof unset, typeof unset, typeof unset, never>`. Compact but unlabeled.
   - `bag-intersect`: `ProcedureBuilder<Omit<{ ctx: Context; …; errors: never }, "ctxOverrides"> & { ctxOverrides: … }>`. **Grows one `Omit<…> &` layer per chained call**, so deep chains have unreadable hovers.
   - `bag-mapped`: `ProcedureBuilder<{ ctx: Context; meta: Meta; ctxOverrides: …; inputIn: typeof unset; …; errors: never }>`. Flat and labeled no matter how long the chain is.
   - Procedures: bags emit `Procedure<{ type: 'query'; input: …; output: …; errors: never }>` vs `Procedure<"query", …, …, never>`. Same information; the ~1.6× `.d.ts` size is the slot labels and indentation.
5. If G-A is chosen, **prefer the flat mapped patch** over `Omit & Patch`: ~5% more instantiations than the intersection, but hovers and declarations stay flat.

## Caveats

- Type-only builders with no runtime; real builders will have more methods (errors, route, services), which grows positional signatures more than bags.
- `--singleThreaded` numbers; tsgo's default parallel checkers hide most of the difference in wall time.
- Hovers were judged from emitted declarations, not an editor session.
