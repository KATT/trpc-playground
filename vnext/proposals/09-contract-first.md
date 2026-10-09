# 09 — Contract-first

| Status     | Area                     | Depends on     | oRPC parity rows                                                       |
| ---------- | ------------------------ | -------------- | ---------------------------------------------------------------------- |
| `proposed` | server, client, contract | 03, 05, 07, 08 | **With contract-first approach**, Nest.js integration, OpenAPI support |

## Summary

Decide how to define an API contract separately from its implementation, how implementations are checked against it, and how clients consume contracts at runtime.

**Recommendation:**

- A contract builder that reuses the procedure builder's definition methods.
- `implement(contract)` gives a builder whose terminals are type-checked against the contract.
- Routers can also be _reduced_ to contracts: at the type level (`inferContract`), and at runtime as minified JSON.

## Today (v11)

There is no contract-first support; a procedure only exists once it has a resolver. The usual workaround is `export type AppRouter`, which leaks server types into the client and causes TS2742 in monorepos (01). oRPC lists tRPC as 🛑 for this row.

## Goals

- Define the API (inputs, outputs, errors, meta, routes) in a package with no server dependencies, and share it with clients, servers, other languages (OpenAPI) and other teams.
- An implementation is checked against the contract: missing procedures, wrong outputs or undeclared errors are type errors and runtime errors.
- Implementation-first users get the same benefits (a client-visible contract type, OpenAPI) without writing a contract.

## Proposed API

```ts
// contract package: depends only on trpcdev/contract + a schema library
import { contract } from 'trpcdev/contract';

const c = contract.create<{ meta: Meta }>();

export const postContract = {
  byId: c
    .route({ method: 'GET', path: '/posts/{id}' })
    .input(z.object({ id: z.string() }))
    .output(Post)
    .errors({ NOT_FOUND: { data: z.object({ id: z.string() }) } })
    .query(), // terminal without a resolver = contract procedure
  create: c.input(NewPost).output(Post).mutation(),
};
export const appContract = { post: postContract };
```

```ts
// server package
const impl = t.implement(appContract);

export const appRouter = impl.router({
  post: {
    byId: impl.post.byId.use(authed).query(async ({ input, errors }) => {
      const post = await db.post.find(input.id);
      if (!post) throw errors.NOT_FOUND({ data: { id: input.id } });
      return post;
    }),
    create: impl.post.create.mutation(({ input }) => db.post.create(input)),
  },
});
```

```ts
// client package: no server types involved
const client = createTRPCClient<typeof appContract>({ links: [httpLink({ url })] });
```

### Design notes

- **Terminal without a resolver.** `.query()` with no argument produces a contract procedure. This reuses the familiar verbs instead of introducing oRPC's `oc` and `.handler()`. The alternative is a separate `contract.procedure({ type: 'query', input, output })` options bag (see Q9.1).
- **`implement()`:**
  - Returns a mirror of the contract tree. Each leaf is a builder pre-loaded with the contract's input, output, errors, meta and route.
  - Allowed: `.use()` (middleware, which may add typed errors only if they are declared in the contract; **open**) and the matching terminal.
  - Not allowed: `.input()` / `.output()`.
  - `impl.router()` checks completeness at the type level and at runtime.
- **Router to contract:**
  - Type level: `inferContract<typeof appRouter>` strips `ctx`, middleware and services.
  - Runtime: `toContract(router)` emits a minified, JSON-serializable contract (paths, types, routes, JSON Schemas). The OpenAPI link (18), client-side validation and codegen use it.
- **Runtime enforcement:** `impl.router()` throws if a contract procedure is missing or has the wrong type. Output and error data are validated against contract schemas by the normal output validation (04).
- **NestJS and other frameworks:** these become a thin adapter over contracts plus `implement`, as in oRPC.

## Options

- **K-A** (as above): contract builder sharing the procedure builder's methods, plus `implement`.
- **K-B:** oRPC-style separate `oc` builder with `.handler()`.
  - ❌ Unfamiliar for tRPC users. It duplicates the builder.
- **K-C:** no dedicated contract builder; contracts are _only_ derived from routers (type-level and `toContract`).
  - ✅ Less API.
  - ❌ Not real contract-first: you cannot write a contract before the implementation. This fails parity.

## Recommendation

**K-A**, with `inferContract` and `toContract`. Contract types are what clients and integrations accept (01, rule 3).

> ⚠️ **Parity:** this row depends on 03 (d). If procedures cannot exist without a resolver, contract-first, the OpenAPI link and NestJS integration are all blocked.

## Questions for Alex

- **Q9.1** Contract syntax: resolver-less terminals (`.query()`), or an options-bag `contract.procedure({ type, input, output })`?
- **Q9.2** Implementation API: `t.implement(contract)` mirror tree (recommended), or `t.procedure.implements(contract.post.byId)`?
- **Q9.3** May implementations add errors not declared in the contract (they would be typed on implementation-first clients but missing from the contract)?
- **Q9.4** Ship `toContract()` (runtime minified contract) in v1?

## Decision

- **Q9.1:** [ ] resolver-less terminals · [ ] options bag
- **Q9.2:** [ ] mirror tree · [ ] `.implements()`
- **Q9.3:** [ ] yes · [ ] no
- **Q9.4:** [ ] yes · [ ] later
- **Notes:**
