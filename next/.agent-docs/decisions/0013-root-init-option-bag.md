# 0013 — Root init is `initTRPC<{ … }>()`, an option-bag generic with no `.create()`

| Proposal                                  | Date       | Status   | Supersedes | Superseded by |
| ----------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [03](../proposals/03-builder-and-init.md) | 2026-10-10 | accepted | —          | —             |

## Decision

- **Q3.1:** "ok let's go with first one then": I-A, the option-bag generic. Alex liked oRPC's look "as it doesn't have the slightly odd `.create()` at the end", so the root is a generic call with no `.create()`:

```ts
const t = initTRPC<{ ctx: Context; meta: Meta }>();

export const publicProcedure = t.procedure;
export const authed = t.procedure.use(auth);
```

Every slot in the bag is optional. New root slots (`services` if 02 S2 wins, anything else later) are new keys, not new methods. A definition-time runtime option, if one is ever needed, goes in the call: `initTRPC<{ … }>({ … })`.

## Rationale

- One option bag matches the "option bags, in type parameters too" principle, and adding a slot doesn't add a method or an intermediate builder type.
- No trailing `.create()`: transport options have moved to the handler (11, 12, 07), so there's nothing left to "create" with.
- `t` is a plain object, so `t.procedure` has no lingering root setters. oRPC's `$context`/`$meta`/`$config`/`$route`/`$input` stay on its root `Builder` (and survive `.errors()`) until a procedure-building method is called. Calling `$context` again silently re-types the context and clears the middleware list (`.repos/orpc/packages/server/src/builder.ts`).

What we give up: v11's `initTRPC.context<C>().meta<M>().create()` doesn't carry over, so migration touches the init line. The generic is explicit-only: nothing passed to `initTRPC()` can be inferred into the bag (no partial type-argument inference).

## Rejected alternatives

- **I-A with `.create()`** (`initTRPC.create<{ … }>()`, 03's original form): the trailing call has no job left.
- **I-B**, v11's chained `.context<>().meta<>().create()`: a method per slot, against the option-bag principle.
- **I-C**, oRPC's `trpc.$context<C>()` with no `t`: the root setters linger on the base builder, and it moves furthest from the familiar `t.procedure…` chain.

## Parity impact

None.

## Follow-ups

- [x] 03 (a), (e), the summary and the recommendation use `initTRPC<{ … }>()`. 02, 04, 06 and 11 examples updated.
- [ ] Q3.5 (keep `t`, top-level imports, or both) is still open.
- [ ] Q3.6 (new): root extensions that add to the bag from values, for example `t.with(openapi())`. Bespoke `$` methods per extension would need E-A's module augmentation. A single generic `.with(ext)` on `t` stays possible with this form, because values can't go in `initTRPC<{ … }>()` itself.
