# 0002 — Resolvers receive `meta`

| Proposal                            | Date       | Status   | Supersedes | Superseded by |
| ----------------------------------- | ---------- | -------- | ---------- | ------------- |
| [04](../proposals/04-procedures.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q4.5:** "yes" — `meta` is in the resolver options, not just middleware.

```ts
t.procedure.meta({ auth: true }).query(({ meta }) => meta.auth);
```

## Rationale

As in 04 (b)/(f): resolvers can read the same metadata middleware sees (for example a cache tag or a feature flag) without a pass-through middleware.

## Rejected alternatives

- Middleware-only `meta` (v11): forces a middleware just to copy `meta` into `ctx`.

## Parity impact

None.

## Follow-ups

- [ ] Include `meta` in the resolver options type when implementing 04 (b).
