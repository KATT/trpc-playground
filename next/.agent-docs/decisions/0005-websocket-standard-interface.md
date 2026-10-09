# 0005 — The WebSocket handler takes a standard `WebSocket`

| Proposal                                             | Date       | Status   | Supersedes | Superseded by |
| ---------------------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [12](../proposals/12-handlers-adapters-platforms.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q12.4:** "yes I think effect has good websocket stuff" — the WebSocket handler accepts a standard `WebSocket`-shaped object; no `ws` dependency.

## Rationale

Every runtime (Bun, Deno, Cloudflare, browsers, Node 22+ client) exposes the WHATWG `WebSocket` interface, and Node servers can adapt `ws` to it. Effect already models this: `effect/socket`'s `Socket.fromWebSocket(WebSocketLike)` and `makeWebSocket` take the same shape.

## Rejected alternatives

- Depending on `ws` or a Node-specific API.

## Parity impact

None (WebSocket row unchanged).

## Follow-ups

- [ ] Evaluate `effect/socket` (`Socket.fromWebSocket`, `Socket.makeWebSocket`) for the WebSocket handler and link internals. It is `@stability unstable` in 4.0.2, so using it depends on Q2.4 (unstable Effect modules behind our own abstractions).
