# 18 — OpenAPI

| Status     | Area                       | Depends on             | oRPC parity rows                                                                                |
| ---------- | -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `proposed` | server, client, generators | 04, 05, 07, 09, 10, 11 | **OpenAPI support**, **OpenAPI support for multiple schema libs**, **OpenAPI bracket notation** |

## Summary

`ideas.md`: "The design must allow OpenAPI support like oRPC."

**Recommendation:**

- Ship an **OpenAPI handler** that serves the same router over REST semantics, plus a **spec generator** driven by schemas (Standard JSON Schema).
- `.route()` customises method, path and status.
- Bracket notation and schema-driven coercion for query strings and forms.
- Declared errors appear in the spec.
- The cleaner RPC protocol (10) can also be described as OpenAPI with zero configuration.

## Today (v11)

- `@trpc/openapi` (alpha) **statically analyses TypeScript types** with the compiler API (`generateOpenAPIDocument('./router.ts')`). It never runs code, and it documents the _native tRPC protocol_, including its envelopes.
- Its TODO list includes SSE, non-JSON content types and "REST translation layer without TrpcEnvelope".
- There is no REST handler, no `.route()` metadata and no bracket notation.
- The community package `trpc-openapi` (unmaintained) and oRPC's `@orpc/trpc` (`toORPCRouter`) fill the gap.

## Goals

- One router served over RPC _and_ REST at the same time (11 moves serialization to endpoints).
- A spec generated from schemas of any library that implements Standard JSON Schema, with no per-library converter packages.
- Typed REST clients via `OpenAPILink`, or generated clients in any language.
- Familiar oRPC-level features: path params, `inputStructure`, bracket notation, coercion, declared error responses, SSE.

## Decision areas

### (a) Scope

- **O-A — OpenAPI handler + generator**, as in oRPC. Procedures map to REST via `.route()`, with sensible defaults.
- **O-B — Describe the RPC protocol only**, as v11 does. With 10's envelope-free protocol, `GET /trpc/post/byId?input=…` is already almost REST.
  - ✅ Nothing new to maintain.
  - ❌ No custom paths or params, and `input=` JSON in query strings is not idiomatic REST.
- **O-C — Both.** The generator can document either the RPC endpoint (zero configuration) or the OpenAPI handler (custom routes).

### (b) Routing and mapping

```ts
const byId = t.procedure
  .route({ method: 'GET', path: '/posts/{id}', successStatus: 200, tags: ['posts'], summary: 'Get a post', inputStructure: 'compact' })
  .input(z.object({ id: z.string(), include: z.array(z.enum(['author'])).optional() }))
  .query(…);

const openapi = createOpenAPIHandler({ router: appRouter, createContext, plugins: [openAPIReference({ path: '/docs' })] });
const spec = await generateOpenAPI(appRouter, { info: { title: 'API', version: '1.0.0' }, servers: [{ url: '/api' }] });
```

- **Defaults without `.route()`:** query → `GET {prefix}/post/byId`, mutation → `POST {prefix}/post/byId`, subscription → `GET` with `text/event-stream`.
- **`inputStructure: 'compact'`:** path params plus query (GET) or body (others) are merged into one input object.
- **`inputStructure: 'detailed'`:** the input is `{ params, query, headers, body }`. `outputStructure: 'detailed'` returns `{ status, headers, body }`.
- **Bracket notation** for query strings and `FormData` (`user[name]=x&tags[]=a`), shared with `action()` forms (15).
- **Coercion:** strings in query, params and forms are coerced using the input's JSON Schema (number, boolean, date-time, arrays).

### (c) Spec generation

- **Runtime, from schemas:** uses `~standard.jsonSchema.input()/output()` (Zod 4.2+, Effect via `Schema.toStandardJSONSchemaV1`), plus a converter fallback for other libraries (05).
- **Procedures without schemas** (for example `type<T>()`) produce `{}` schemas, unless documented via `.route({ spec })`.
- **Errors:**
  - Declared errors (07 A) produce responses with their status and `data` schema.
  - Inferred-only errors appear as `code` enums without data schemas.
  - Input validation errors produce a standard 400 schema.
- **Static generator:** v11's TS-compiler-based generator could remain as an optional tool for type-only routers (**open**, Q18.3).

### (d) Clients

- `openAPILink({ url, contract })` calls the REST endpoints with the same `createTRPCClient`. It needs a runtime contract (09 `toContract`) for methods and paths.
- Generated clients in other languages come from the spec. A Hey API plugin (OpenAPI → tRPC contract) comes later.

### (e) Docs UI

An `openAPIReference()` handler plugin serves Scalar (or Swagger UI) from a CDN at `/docs`, plus `/openapi.json`.

## Recommendation

- **O-C**, with the OpenAPI handler (O-A) as the main v1 feature.
- Runtime generation from Standard JSON Schema.
- Bracket notation and coercion.
- `openAPILink` once `toContract` exists.
- Scalar reference plugin.
- Defer the static generator until we know who needs it.

> ⚠️ **Parity:** this needs serializers on endpoints (11), route metadata in the contract (03 (d), 04 (g)) and schema-based JSON Schema (05). If any of those is rejected, OpenAPI drops back to 🟡.

## Questions for Alex

- **Q18.1** Scope: OpenAPI handler + generator (O-A), RPC description only (O-B), or both (O-C)?
- **Q18.2** Default REST mapping without `.route()`: `GET|POST {prefix}/post/byId` (recommended), or require `.route()` for every procedure exposed via OpenAPI?
- **Q18.3** Keep v11's static TypeScript generator as an optional tool?
- **Q18.4** `openAPILink` in v1?
- **Q18.5** Ship a Scalar/Swagger reference plugin?

## Decision

- **Q18.1:** [ ] O-A · [ ] O-B · [ ] O-C
- **Q18.2:** [ ] defaults · [ ] require `.route()`
- **Q18.3:** [ ] keep · [ ] drop · [ ] later
- **Q18.4:** [ ] v1 · [ ] later
- **Q18.5:** [ ] yes · [ ] no
- **Notes:**
