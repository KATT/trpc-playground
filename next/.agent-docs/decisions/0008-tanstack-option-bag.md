# 0008 — TanStack Query helpers take an option bag

| Proposal                                | Date       | Status   | Supersedes | Superseded by |
| --------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [19](../proposals/19-tanstack-query.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q19.2:** "bag" — `queryOptions({ input, ...tanstackOptions })`, not v11's positional `queryOptions(input, opts)`.

```ts
useQuery(trpc.post.byId.queryOptions({ input: { id }, staleTime: 1000 }));
```

## Rationale

The spike ([`notes/tanstack-options-typing.md`](../notes/tanstack-options-typing.md)) showed the bag types identically to the positional form (`select` inference, `skipToken`, `DataTag` keys), and keeps excess-property errors for misspelled options. One argument leaves room for future options.

## Rejected alternatives

- Positional `(input, opts)` (v11).

## Parity impact

None.

## Follow-ups

- [ ] Q19.3 (infinite input) is still open; the spike's annotation pitfall applies if the explicit `input: (pageParam) => …` form is chosen.
