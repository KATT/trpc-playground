# 0001 — `'~trpc'` replaces `_def`

| Proposal                                  | Date       | Status   | Supersedes | Superseded by |
| ----------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [03](../proposals/03-builder-and-init.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q3.4:** "1y" — yes, rename `_def` to `'~trpc'`.

```ts
appRouter.post.byId['~trpc'].kind; // v11: ._def.type
appRouter.post.byId['~trpc'].route;
```

## Rationale

From 03 (d): the key follows Standard Schema's `~standard` convention. Keys starting with `~` sort last and are hidden from most autocomplete lists, and the name is namespaced, so it won't collide with user keys. We give up v11 familiarity for code that reads `_def` (codegen, community tooling); there is no alias.

## Rejected alternatives

- Keep `_def`: shows up in autocomplete next to procedures, and v11's `_def` mixes the procedure definition with router config (`_def._config`).

## Parity impact

None.

## Follow-ups

- [ ] When implementing 03 (d): procedure and router definitions live under `'~trpc'`; no `_def` alias.
- [ ] 08: reserve router keys starting with `~` (already in 08's Details), so `'~trpc'` can't collide with a route.
