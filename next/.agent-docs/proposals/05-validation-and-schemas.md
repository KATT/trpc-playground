# 05 — Validation and schemas

| Status     | Area   | Depends on | oRPC parity rows                                                                            |
| ---------- | ------ | ---------- | ------------------------------------------------------------------------------------------- |
| `proposed` | server | 02, 04     | Standard Schema, OpenAPI support for multiple schema libs, End-to-end typesafe input/output |

## Summary

Decide which validators vNext accepts, how input and output types are derived, and how schemas produce JSON Schema for OpenAPI.

**Recommendation:**

- Accept **Standard Schema only**, plus Effect Schema natively, and drop every legacy parser.
- Add a `type<T>()` helper for unvalidated types.
- Keep input chaining.
- Use Standard JSON Schema for OpenAPI.

## Today (v11)

`packages/server/src/unstable-core-do-not-import/parser.ts` accepts:

- Standard Schema;
- Zod (`.parse`), myzod, Superstruct, Yup, Scale, Valibot (legacy), ArkType (`.assert`);
- Effect's old `ParseResult` style, through a comment and duck typing;
- plain `(input) => output` functions.

Each format needs a hand-written type inference branch.

Chained `.input()` calls merge object inputs, which middleware-built "base procedures with a common input" rely on. Validation errors become `BAD_REQUEST` with a `cause` that users have to format themselves (for example with `zod-error` in the formatter).

[#6423](https://github.com/trpc/trpc/pull/6423): "now that Standard Schema is out, we can … only support schemas".

## Goals

- One inference path. Every library that matters already implements Standard Schema: Zod 3.24+/4, Valibot 1, ArkType 2, Effect via `toStandardSchemaV1`.
- Effect Schema works without wrapping and keeps its decode/encode (codec) semantics.
- Validation issues reach the client in a typed, standard shape.
- JSON Schema generation without per-library converters (18).

## Decision areas

### (a) Accepted validators

- **V-A — Standard Schema v1 + Effect Schema.**
  - An Effect `Schema` is detected (`Schema.isSchema`) and wrapped internally with `Schema.toStandardSchemaV1` / `toStandardJSONSchemaV1`, preserving `Type`/`Encoded`.
  - Everything else must expose `~standard`.

  ```ts
  // V-A
  const Post = Schema.Struct({ id: Schema.String, createdAt: Schema.DateFromString });

  t.procedure.input(z.object({ id: z.string() })).query(…); // Standard Schema
  t.procedure.input(Schema.Struct({ id: Schema.String })).output(Post).query(…); // Effect Schema, unwrapped
  ```

- **V-B — Standard Schema only.** Effect users call `Schema.toStandardSchemaV1(s)` themselves.
  - ✅ Zero special cases.
  - ❌ First-class Effect support is weaker; Effect users must remember to wrap every schema.

  ```ts
  // V-B
  t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })))
    .output(Schema.toStandardSchemaV1(Post))
    .query(…);
  t.procedure.input(Schema.Struct({ id: Schema.String })); // type error: no `~standard`
  ```

- **V-C — Keep legacy parsers.**
  - ❌ Complexity, slower types, no JSON Schema story.

  ```ts
  // V-C: v11's parser formats keep working
  t.procedure.input(yup.object({ id: yup.string().required() })).query(…); // `.validateSync`
  t.procedure.input((raw: unknown) => raw as { id: string }).query(…); // plain function
  ```

### (b) Unvalidated types

```ts
t.procedure.input(type<{ id: string }>()).query(…); // no runtime validation
```

`type<T>()` returns a Standard Schema that passes the value through. This replaces v11's "plain function" parsers for the "trust me" case. It is useful with contracts and for internal procedures.

### (c) Input chaining

- **C-A — Keep chaining.** Objects are merged; non-objects error at the type level. Base procedures can then require an `{ orgId }` input that middleware reads (`opts.input` in middleware is typed by the inputs declared so far).

  ```ts
  // C-A
  export const orgProcedure = t.procedure
    .input(z.object({ orgId: z.string() }))
    .use(async ({ ctx, input, next }) => {
      // input: { orgId: string }
      return next({ ctx: { org: await ctx.db.org(input.orgId) } });
    });

  export const members = orgProcedure
    .input(z.object({ role: z.enum(['admin', 'member']) }))
    .query(({ ctx, input }) => ctx.db.members(ctx.org, input.role)); // input: { orgId: string; role: … }

  orgProcedure.input(z.string()); // type error: cannot merge a non-object input
  ```

- **C-B — Single `.input()`.** Simpler, and closer to oRPC.

  ```ts
  // C-B: each procedure declares its whole input; shared logic uses dependency-declaring middleware (06 (d))
  export const members = t.procedure
    .input(z.object({ orgId: z.string(), role: z.enum(['admin', 'member']) }))
    .use(withOrg) // requires input.orgId
    .query(({ ctx, input }) => ctx.db.members(ctx.org, input.role));

  t.procedure.input(A).input(B); // type error: no `.input()` after the first, as in oRPC's builder
  ```

> **Spike (2026-10-09):** [`notes/middleware-and-input-typing.md`](../notes/middleware-and-input-typing.md). C-A types cleanly: object inputs merge, the client input is built from the schemas' input types, and middleware sees the inputs declared so far. Non-object or conflicting chains can be rejected on the offending `.input()` with a named error. The conflict check is shallow. `type<T>()` needs nothing special.

### (d) Input as a function of `ctx`

[#6423](https://github.com/trpc/trpc/pull/6423) explored `.input(({ ctx }) => schema)`. This is rarely needed and complicates contracts and OpenAPI. **Recommend no.**

```ts
// as explored in #6423 (not recommended)
t.procedure
  .input(({ ctx }) =>
    z.object({ limit: z.number().max(ctx.user.isPro ? 1000 : 100) }),
  )
  .query(({ input }) => db.post.list(input.limit)); // no static schema for contracts or OpenAPI
```

### (e) Validation errors

- Input validation failure produces `BAD_REQUEST` with `data.issues: StandardSchemaV1.Issue[]` (`{ message, path }`) by default.
- This is a built-in "declared" error, so it is typed on the client for every procedure with an input (07).
- **Open:** whether `issues` are included in production (they can leak schema details). Recommend including them, since they are user-facing input errors.

```ts
const [post, err] = await safe(client.post.create.mutate({ title: '' }));
if (err?.defined && err.code === 'BAD_REQUEST') {
  for (const { path, message } of err.data.issues)
    showFieldError(path, message); // StandardSchemaV1.Issue
}
```

### (f) JSON Schema

- Use **Standard JSON Schema** (`~standard.jsonSchema.input/output({ target })`) when present. Zod 4.2+ implements it (checked in `node_modules/zod`) and Effect provides `Schema.toStandardJSONSchemaV1`.
- Fallback: a `jsonSchema` option on `.input()`/`.output()`, or a pluggable converter for libraries without Standard JSON Schema.
- Input and output schemas are converted separately (`input` versus `output` mode). This matters for transforms and codecs.

```ts
// what the generator (18) calls; no per-library converter
const NewPost = z.object({ title: z.string() });
NewPost['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

const Post = Schema.toStandardJSONSchemaV1(
  Schema.Struct({ createdAt: Schema.DateFromString }),
); // done internally under V-A
Post['~standard'].jsonSchema.input({ target: 'openapi-3.0' }); // Encoded side: createdAt is a string
Post['~standard'].jsonSchema.output({ target: 'openapi-3.0' }); // Type side

// fallback for a schema without Standard JSON Schema
t.procedure.input(legacySchema, {
  jsonSchema: { type: 'object', properties: { title: { type: 'string' } } }, // option shape TBD
});
```

### (g) Output schemas and codecs

- `.output(schema)`: the server **encodes** with the schema (for example `Date` to ISO string for an Effect `Schema.Date` codec). The client type is the decoded `Type` when using the rich serializer (11). Client-side decoding is only possible with a runtime contract (09).
- **Open:** whether the client should decode with output schemas when a contract is available. This is oRPC's response validation plugin.

```ts
const Post = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.DateFromString,
});

export const byId = t.procedure
  .input(Schema.Struct({ id: Schema.String }))
  .output(Post)
  .query(() => ({ id: '1', createdAt: new Date() })); // resolver returns Post.Type; the server encodes createdAt to a string

const post = await client.byId.query({ id: '1' }); // post.createdAt typed as Date (the decoded Type, with the rich serializer from 11)
```

## Recommendation

- **V-A** (Standard Schema + native Effect Schema).
- `type<T>()`.
- **C-A** (keep chaining).
- No `ctx`-dependent inputs.
- `BAD_REQUEST` with `data.issues`, built in and typed.
- Standard JSON Schema with a converter fallback.

## Questions for Alex

- **Q5.1** Native Effect Schema (V-A) or Standard Schema only (V-B)?
- **Q5.2** Add `type<T>()` for unvalidated inputs/outputs?
- **Q5.3** Keep input chaining (C-A) or a single `.input()` (C-B)?
- **Q5.4** Include validation `issues` in production error responses?
- **Q5.5** Should clients decode outputs with schemas when a runtime contract is available (later, opt-in)?

## Decision

- **Q5.1:** [ ] V-A · [ ] V-B
- **Q5.2:** [ ] yes · [ ] no
- **Q5.3:** [ ] C-A · [ ] C-B
- **Q5.4:** [ ] yes · [ ] no · [ ] configurable, default `____`
- **Q5.5:** [ ] yes, later · [ ] no
- **Notes:**
