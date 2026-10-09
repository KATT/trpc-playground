# 0010 — Keep a router merge helper that rejects duplicate keys

| Proposal                         | Date       | Status   | Supersedes | Superseded by |
| -------------------------------- | ---------- | -------- | ---------- | ------------- |
| [08](../proposals/08-routers.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q8.2:** "helper" — no: don't replace `mergeRouters` with object spread. Keep a variadic merge helper that errors on duplicate keys, at the type level and at runtime.

```ts
export const appRouter = mergeRouters(postRouter, userRouter); // name TBD; v11's is mergeRouters
mergeRouters(a, b); // type error + runtime error if a and b share a key
```

## Rationale

The spike ([`notes/contracts-and-routers-typing.md`](../notes/contracts-and-routers-typing.md)) showed that `{ ...a, ...b }` silently keeps `b`'s value for a shared key, and the duplicate is gone at runtime too, so neither types nor `createHandler()` can catch it. The proposal's "duplicate keys are a type error" only holds with a helper that sees the parts separately.

Spread still works for plain-object routers (Q8.1 is open); it just isn't checked.

## Rejected alternatives

- Spread only, accepting silent overwrites (08's recommendation).

## Parity impact

None.

## Follow-ups

- [x] 08 "Details → Merging" marked as superseded by this decision.
- [ ] Choose the name when implementing (default: keep `mergeRouters`).
