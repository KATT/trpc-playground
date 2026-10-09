# 0012 — No `type<T>()` for unvalidated inputs

| Proposal                                        | Date       | Status   | Supersedes | Superseded by |
| ----------------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [05](../proposals/05-validation-and-schemas.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q5.2:** "I want to kill any support for that as I also want inputs to be able to have callback where we get the context etc so you can do context aware stuff in the validators." No `type<T>()` helper, and no other unvalidated input or output form: v11's plain `(input) => output` parsers are gone too.

```ts
t.procedure.input(type<{ id: string }>()); // ❌ no such helper
t.procedure.input((raw: unknown) => raw as { id: string }); // ❌ not a parser any more
t.procedure.input(z.object({ id: z.string() })); // ✅ every input is validated
```

## Rationale

`.input()` keeps one meaning: a schema that validates. Freeing the function form leaves room for a ctx-aware callback, `.input(({ ctx }) => schema)`, without guessing whether a function is a parser or a callback. That callback is still open; it is spiked in [`notes/context-aware-inputs.md`](../notes/context-aware-inputs.md).

What we give up: a zero-cost "trust me" input for internal procedures and contracts. Users write a real schema instead.

## Rejected alternatives

- `type<T>()` as a pass-through Standard Schema (05's recommendation).
- Keeping v11's plain-function parsers (V-C).

## Parity impact

None. oRPC's `type<T>()` is a convenience, not a comparison row.

## Follow-ups

- [x] 05 (b) marked as decided; the recommendation no longer lists `type<T>()`.
- [x] 18: schema-less procedures are now "no `.input()`" or a ctx callback, not `type<T>()`.
- [ ] 17 D-C's `router: type<AppRouter>()` said it reused this helper. It is a type carrier for the client, not an input, so it can still exist under its own name; ask Alex.
- [ ] Q5.6 (new): how ctx-aware validation works, if at all.
