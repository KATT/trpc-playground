# 0015 — Agent judgement calls for the first v12 build

| Proposal  | Date       | Status      | Supersedes | Superseded by |
| --------- | ---------- | ----------- | ---------- | ------------- |
| (several) | 2026-10-10 | provisional | —          | —             |

Alex asked for a first build of v12 "following what we've said in ideas.md. For decisions where you're waiting for human, make a judgement call — refactoring is cheap and we can do that later." Every call below is the agent's, not Alex's. Each one is cheap to revisit. Where a call departs from a proposal's recommendation, the reason is given.

## Decision

### Builder and procedures (03, 04)

- **Q3.2 generics:** G-A, a mapped definition bag. The builder carries one `TDef` object type.
- **Q3.3 errors on `t`:** no `t.error`; errors come from `error()` (07).
- **Q4.1 procedure types:** T-A, keep `query`, `mutation` and `subscription`.
- **Resolver options:** `{ ctx, input, meta, path, type, signal }`, plus `lastEventId` on subscriptions. `response` (R-A) and `errors` constructors (07 A) are not built yet.
- **`.output()`** validates by default. The resolver returns the schema's input type, and the client sees its output type.

### Validation (05)

- **Q5.1:** V-A, Standard Schema and Effect Schema only (0012).
- **Q5.3:** C-A, inputs chain. Each schema sees the raw input, and object outputs are merged.
- **Q5.6:** D-A, `.input(({ ctx, meta, path }) => schema)` is the context-aware form. D-C (Effect Schema services) works too, because inputs are decoded with the procedure's provided services.

### Middleware (06)

- **N-A:** `next({ ctx })`.
- Middleware may return a `TRPCError` instead of calling `next()`. It short-circuits the call, and the error joins the procedure's error union (07 B).
- **Standalone middleware:** `t.middleware(fn)` types `fn` against the root, and a middleware is a plain function, so the builder checks requirements through parameter contravariance.
- **Effect services:** `.provide(Service, (opts) => value | Effect)` provides a service to everything after it. It is the M-A stand-in that the 06 (g) spike typed. `t.middleware.effect` is a follow-up.
- No `ok()` short-circuit yet.

### Effect (02)

- **Q2.1:** A1, one builder with runtime detection of `Effect`, `Stream`, `AsyncIterable` and `Promise` returns.
- **Q2.2:** S1, inferred services. The proposal recommends S2, but with plain-object routers (08 A) nothing carries a declared set, so the handler would have to be given `t`. Under S1 the router type carries `R`, and the handler's `layer` must provide `inferRouterServices<typeof router>`.
- **Q2.3:** d.i. A typed failure that is not a `TRPCError` is dropped from the error union and becomes a masked `INTERNAL_SERVER_ERROR`. d.ii (a compile error) is a follow-up, once the error-mapping helpers exist.

### Errors (07)

- The combined model. One isomorphic `TRPCError` class, built on Effect's `Data.Error` so it is yieldable, with `code`, `status`, `data` and `defined`.
- `error({ code, data?, message?, status? })` constructs one. Returned or failed `TRPCError`s are inferred into the union.
- **Q7.3 `safe()`:** returns `[data, error]` that also carries `{ data, error }` properties, so both destructuring styles work.
- **Q7.5 (0003):** unexpected errors are masked unless the handler sets `exposeUnexpectedErrors: true`. It defaults to `true` only when `NODE_ENV` is `development` or `test`.
- **Q7.7:** one class, the same `TRPCError` on server and client.

### Routers and server-side calls (08, 15)

- **Q8.1:** A, plain objects. Keys are path segments, and `mergeRouters` rejects duplicates (0010).
- **Path separator (Q10.2):** `.`, in both `path` and URLs (`/trpc/post.byId`).
- **SC-A:** `createRouterClient(router, { ctx, layer })` has the same shape as the HTTP client, so tests and SSR read the same. `call(procedure, input, { ctx })` exists for a single procedure.

### Protocol and serialization (10, 11, 14)

- **10 Option B**, as written, with these specifics:
  - Bodies keep danSON's `{ json, refs? }` wrapper. Dropping it is a follow-up.
  - Queries use `GET` with legible params (QP-C) and fall back to `POST` above `maxURLLength`. Mutations require `POST` with `content-type: application/json`, which is the CSRF guard.
  - Errors are `{ error: { code, message, data, defined } }`, with the status from the error.
  - Batching is `POST {base}` with `trpc-batch: 1`, answered with JSONL lines in completion order: `{ i, status, body }`, plus `{ i, chunk }` for deferred values.
  - Deferred values (a `Promise` or `AsyncIterable` nested in an output) stream as JSONL using danSON's async format. The server only switches to JSONL when the output contains one, so plain responses stay `application/json`.
  - Subscriptions use fetch-streamed SSE (0006). Each event's `data:` is one serialized value. `tracked(id, data)` sets `id:`, and the client resumes with `last-event-id`. An `event: error` carries a serialized error, and `event: done` ends the stream. Deferred values nested inside events are not supported yet.
  - `trpc-version: 1` on requests and responses. A mismatch is `UNSUPPORTED_PROTOCOL` (400).
- **11 S-A:** the danSON port is the default serializer. It is configured on the endpoint: the handler and `httpLink` both take `serializer`.

### Handlers (12)

- **P-A:** `createFetchHandler({ router, createContext?, layer?, serializer?, onError?, batch?, endpoint? })` returns `{ fetch, dispose }`. `trpcdev/node` adapts it to `node:http`.

### Client and links (16, 17)

- **CS-A:** `query(input, { signal, context })`, `mutate(…)`, and `subscribe(input, { signal, lastEventId })` returning an `AsyncIterable`.
- **Typing source:** `createTRPCClient<AppRouter>({ links })`. The recommended D-C (`router: type<AppRouter>()`) needs a type-carrier helper that doesn't exist yet. Link-declared context typing is a follow-up, so `context` is the open `TRPCClientContext` interface for now.
- **L-B / OR-A:** links run on an Effect core where every operation is a `Stream`. `link(async ({ op, next }) => …)` is the Promise form, and `link.effect(({ op, next }) => Stream)` is the Effect form.
- **F-B:** link fields live under `context`.
- **Built-in links:** one `httpLink` (`batch`, streaming and SSE by negotiation), `splitLink`, `loggerLink`, `retryLink` and `localLink`. `wsLink`, `messagePortLink` and `dedupeLink` are follow-ups.
- **Effect client:** `createEffectClient` in `trpcdev/effect`. Each call returns an `Effect` (or a `Stream` for subscriptions).

## Rationale

These are the proposals' recommendations wherever one exists and nothing blocks it. The departures are S1 over S2 (02), the explicit generic over D-C (17), and d.i over d.ii (02). Each one is there because the recommended option depends on something not built yet. Refactoring is cheap at this stage, so the build favours a working, tested end-to-end slice over settling every type-level question first.

## Rejected alternatives

- Waiting for each answer before building: rejected by Alex's instruction.

## Parity impact

None recorded yet. `../reference/orpc-parity.md` should be updated once these are confirmed.

## Follow-ups

- [ ] Alex confirms or overrides each call. Superseding decisions replace this file's rows one by one.
- [ ] D-C typing source with link-declared context (17).
- [ ] d.ii strict `E` mapping (02).
- [ ] `t.middleware.effect`, `ok()`, lifecycle helpers (06).
- [ ] `response` handle and declared `.errors()` map (04, 07).
- [ ] `wsLink`, `messagePortLink`, `dedupeLink`, contract-first, OpenAPI.
