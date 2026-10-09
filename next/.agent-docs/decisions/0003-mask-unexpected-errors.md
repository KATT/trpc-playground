# 0003 — Mask unexpected error messages in production

| Proposal                        | Date       | Status   | Supersedes | Superseded by |
| ------------------------------- | ---------- | -------- | ---------- | ------------- |
| [07](../proposals/07-errors.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q7.5:** "yes" — unexpected (undeclared) errors have their message masked in production by default.

## Rationale

From 07 §6: thrown non-`TRPCError` values and undeclared failures can leak internals (SQL, stack details). The client gets `INTERNAL_SERVER_ERROR` with a generic message; the original goes to the handler's `onError`. Declared and returned errors are user-facing and are not masked.

## Rejected alternatives

- Unmasked by default (v11): relies on every app remembering to sanitise in a formatter.

## Parity impact

None.

## Follow-ups

- [ ] Define "production" when implementing (handler option, defaulting from `NODE_ENV` or similar) and an opt-out.
