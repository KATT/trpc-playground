# 0014 — Keep the `t` object; standalone plugin packages must work through `.concat()`

| Proposal                                  | Date       | Status   | Supersedes | Superseded by |
| ----------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [03](../proposals/03-builder-and-init.md) | 2026-10-10 | accepted | —          | —             |

## Decision

- **Q3.5:** "let's keep `t`, but we need to make sure that we can still make some sort of plugins of standalone packages... what we now have in `.concat()` where a plugin can have a requirement of a specific thing or add it etc"

```ts
const t = initTRPC<{ ctx: Context; meta: Meta }>(); // 0013
export const authed = t.procedure.use(isAuthed);

// a standalone package: its own `t` is its requirement
const pluginT = initTRPC<{
  ctx: { db: AuditDb; user: { id: string } };
  meta: { audit?: boolean };
}>();
export const auditPlugin = pluginT.procedure.use(async ({ next }) =>
  next({ ctx: { auditedBy: '…' } }),
);

// the app
authed.concat(auditPlugin); // checks ctx and meta, adds `auditedBy`
```

**Requirement:** a package can publish a builder fragment that requires ctx and meta and adds ctx and inputs. The app composes it with `.concat()`. This must keep working as the builder grows (errors in 07, services in 02).

## Rationale

`t` keeps the root types in one place, and shared middleware gets them for free. It's also what v11 users know. Top-level imports would need oRPC's bottom-up context model (a base builder with an initial and a current context) to keep inference.

The spike ([`notes/concat-plugins.md`](../notes/concat-plugins.md)) confirms that `.concat()` works with 0013's root:

- requirements are checked against the current ctx;
- errors name the missing key;
- contributions flow on;
- the published `.d.ts` is readable.

## Rejected alternatives

- Top-level imports only (`import { procedure } from 'trpcdev/server'`).
- Both forms: more API surface for the same thing.

## Parity impact

None.

## Follow-ups

- [x] 03 Q3.5 ticked; 06 (e) links the spike.
- [ ] 01 portability rules: every type a builder can contain is exported (the spike hit TS2527 on a private `unique symbol`), and the portability fixture includes a plugin package that publishes a builder.
- [ ] When 07 (declared errors) and 02 (services) are decided, `.concat()` merges those bag slots too, with the same named-key checks.
- [ ] Open: whether a middleware that needs missing ctx should be a type error (this spike, v11) or a requirement passed to the procedure's callers (oRPC). Not asked yet.
