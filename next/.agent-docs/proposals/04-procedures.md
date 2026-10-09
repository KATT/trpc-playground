# 04 — Procedures: types, resolvers, outputs and metadata

| Status     | Area   | Depends on | oRPC parity rows                                  |
| ---------- | ------ | ---------- | ------------------------------------------------- |
| `proposed` | server | 02, 03     | End-to-end typesafe input/output, OpenAPI support |

## Summary

Decide which procedure types exist, what a resolver receives and may return, how outputs are validated, and how procedures declare metadata and HTTP routing.

**Recommendation:**

- Keep `query`, `mutation` and `subscription`. The resolver receives one options bag.
- A resolver may return a value, a Promise, an Effect, an async iterable or a Stream, or _return_ an error (07).
- Response headers and status are set through a `response` handle.
- `.route()` is first-class.

## Today (v11)

- `.query(fn)`, `.mutation(fn)`, `.subscription(fn)`. The resolver gets `{ ctx, input, signal, path, type, getRawInput }`.
- Queries and mutations may return async iterables; these are streamed over `httpBatchStreamLink`.
- `.output(schema)` validates the resolver output.
- `.meta(obj)` merges shallowly. `defaultMeta` is set in `create()`.
- Response headers and status are set via the endpoint-level `responseMeta()` callback or by mutating `ctx.resHeaders`, which depends on the adapter.
- HTTP mapping is fixed: query maps to GET, mutation to POST, subscription to SSE or WebSocket.

## Goals

- Keep the familiar verbs: `.query()`, `.mutation()`, `.subscription()`.
- One options bag for resolvers, extensible without breaking changes.
- A portable way to set headers, status and cookies that works across adapters and in batches.
- Per-procedure HTTP routing metadata for OpenAPI (18).

## Decision areas

### (a) Procedure types

- **T-A — Keep three types.** `query` (safe and idempotent, may use GET and be cached), `mutation` (POST) and `subscription` (long-lived stream with reconnect semantics).
  - ✅ Familiar. Integrations need the distinction (TanStack `queryOptions` versus `mutationOptions`, HTTP method, caching).
- **T-B — oRPC style, one `.handler()`**, with the kind inferred from `.route({ method })`.
  - ✅ Fewer concepts.
  - ❌ Loses semantic intent. Clients cannot choose GET/POST or query/mutation helpers without route metadata.

### (b) Resolver options

```ts
t.procedure.input(schema).query(async ({ ctx, input, signal, path, meta, response }) => { … });
```

| Field         | Notes                                                               |
| ------------- | ------------------------------------------------------------------- |
| `ctx`         | Context after middleware (06)                                       |
| `input`       | Parsed input (05)                                                   |
| `signal`      | `AbortSignal`, aborted on client disconnect or timeout              |
| `path`        | `'post.byId'`                                                       |
| `meta`        | Procedure meta (in v11 only middleware gets it)                     |
| `response`    | Response handle, see (d)                                            |
| `errors`      | Typed error constructors, only if a declared error map is used (07) |
| `lastEventId` | Subscriptions only (14)                                             |

### (c) Return values

| Return type                                          | Meaning                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `T` / `Promise<T>`                                   | Output                                                                                                                                    |
| `Effect<T, E, R>`                                    | Output, typed errors `E`, services `R` (02)                                                                                               |
| `AsyncIterable<T>` / `Stream<T, E, R>`               | Streamed output (14)                                                                                                                      |
| a returned `TRPCError` (if 07 picks returned errors) | Typed error, not thrown                                                                                                                   |
| `File` / `Blob`                                      | Binary response (11)                                                                                                                      |
| `Response` (raw)                                     | **Open, Q4.3.** Escape hatch from [#6488](https://github.com/trpc/trpc/pull/6488): typed on the client as `Response`, skips serialization |

### (d) Response headers and status

- **R-A — Mutable handle in resolver and middleware options:**

  ```ts
  .mutation(async ({ input, response }) => {
    response.headers.append('set-cookie', cookie);
    response.status = 201; // ignored, with a dev warning, inside batches
    return created;
  });
  ```

  - In batches, headers from all calls are merged and status falls back to the batch status (207 or 200; see 10).

- **R-B — Return wrapper:** `return respond(created, { status: 201, headers })`.
  - ✅ Pure.
  - ❌ Middleware cannot set headers this way; the output type needs unwrapping.
- **R-C — Endpoint-level only** (`responseMeta`-like plugin hook).
  - ❌ Same pain as v11.

### (e) Output validation

- `.output(schema)` validates and _encodes_ the output (with Effect Schema codecs or Standard Schema output types).
- An invalid output is an `INTERNAL_SERVER_ERROR` that is never exposed to the client. In development it logs the issues.
- **Open (Q4.4):** an option to skip output validation in production for performance.

### (f) Meta

- Keep `.meta(obj)` with **shallow merge** across chained calls.
- Default meta is set by calling `.meta()` on the base procedure, so `defaultMeta` disappears from `create()`.
- Meta is available to middleware and resolvers, and through the router definition (for codegen/OpenAPI).

### (g) Route metadata

```ts
t.procedure
  .route({ method: 'GET', path: '/posts/{id}', successStatus: 200, tags: ['posts'], summary: 'Get a post' })
  .input(z.object({ id: z.string() }))
  .query(…);
```

- Part of the contract (03 (d)). It is ignored by the RPC endpoint and used by the OpenAPI endpoint, link and generator (18).
- `t.router({ … }, { prefix, tags })` or `.prefix()` / `.tag()` give route defaults (08).

## Recommendation

- **T-A** (keep the three types).
- The resolver options bag as in (b), including `meta`.
- **R-A** (mutable response handle), documented for batches.
- `.output()` validates by default.
- `.route()` is first-class.
- No raw `Response` returns in v1. Revisit after OpenAPI, which needs binary or streaming responses anyway.

## Questions for Alex

- **Q4.1** Keep three procedure types (T-A), or a single `.handler()` (T-B)?
- **Q4.2** Response headers/status: mutable handle (R-A), return wrapper (R-B) or endpoint-only (R-C)?
- **Q4.3** Allow returning a raw `Response` from a procedure?
- **Q4.4** Option to skip output validation in production?
- **Q4.5** Expose `meta` to resolvers (not just middleware)?

## Decision

- **Q4.1:** [ ] T-A · [ ] T-B
- **Q4.2:** [ ] R-A · [ ] R-B · [ ] R-C
- **Q4.3:** [ ] yes · [ ] no · [ ] later
- **Q4.4:** [ ] yes · [ ] no
- **Q4.5:** [ ] yes · [ ] no
- **Notes:**
