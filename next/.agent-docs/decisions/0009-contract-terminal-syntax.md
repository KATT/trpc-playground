# 0009 — Contracts use resolver-less terminals

| Proposal                                | Date       | Status   | Supersedes | Superseded by |
| --------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [09](../proposals/09-contract-first.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q9.1:** "first" — contract procedures are written with the procedure builder's methods and a terminal with no resolver.

```ts
const c = contract.create<{ meta: Meta }>();
export const byId = c.input(ById).output(Post).query();
```

## Rationale

Reuses the verbs tRPC users know instead of a second syntax. The spike ([`notes/contracts-and-routers-typing.md`](../notes/contracts-and-routers-typing.md)) showed it produces exactly the same types as the options bag, so nothing is lost.

## Rejected alternatives

- Options bag `contract.procedure({ type, input, output })`.

## Parity impact

None by itself. Contract-first parity still depends on 03 (d) allowing procedures without a resolver, and on Q9.2.

## Follow-ups

- [ ] 03 (d): the procedure definition must support a missing resolver.
