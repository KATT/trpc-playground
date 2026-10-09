# 12 — Handlers, adapters and platforms

| Status     | Area             | Depends on | oRPC parity rows                                                                    |
| ---------- | ---------------- | ---------- | ----------------------------------------------------------------------------------- |
| `proposed` | server, adapters | 02, 10     | WebSockets, Cloudflare WebSocket hibernation, **Message Port**, Nest.js integration |

## Summary

`ideas.md`: "Node compatibility is solved the way Effect injects platforms."

**Recommendation:**

- A web-standard, transport-agnostic core handler that is created once.
- Thin platform adapters. Platform capabilities are modelled as Effect services and provided by per-platform Layers inside our own subpaths.
- No third-party runtime dependencies.
- Optional interop with `effect/http` for Effect users.

## Today (v11)

- **Adapters:** standalone, node-http, Express, Fastify, fetch, AWS Lambda, Next (pages and app), and ws.
- Each adapter calls `resolveResponse()` per request with the full option set, for example `fetchRequestHandler({ req, router, createContext, endpoint })`.
- Node's `IncomingMessage` is converted to a `Request` by hand-written code (`incomingMessageToRequest`).
- The ws adapter takes a user-supplied `ws` server (`applyWSSHandler({ wss })`) and implements its own protocol.
- There is no Cloudflare hibernation or MessagePort support.

## Goals

- One handler, created once, that runs on Node, Bun, Deno, Cloudflare, Vercel, Lambda, Electron and workers.
- The core imports no `node:*` modules. Platform code lives in platform subpaths.
- Testable: a platform can be swapped for an in-memory one (`./testing`).
- Zero third-party runtime dependencies besides `effect`.

## Options

### P-A — Own web-standard core plus platform Layers (recommended)

```ts
const handler = createHandler({
  router: appRouter,
  createContext, // 06
  serializer: rich(), // 11 (default)
  plugins: [cors(), bodyLimit({ max: '1mb' })], // 13
  layer: AppLayer, // 02 (Effect users only)
  onError: ({ error, path }) => log(error),
});

// Fetch platforms: Bun, Deno, Cloudflare, Vercel, Next.js route handlers, Hono
export default {
  fetch: (req: Request) => handler.fetch(req, { prefix: '/trpc' }),
};

// Composing with other routes
const { matched, response } = await handler.handle(request, {
  prefix: '/trpc',
});

// Node
import { toNodeListener } from 'trpcdev/server/node';
http.createServer(toNodeListener(handler, { prefix: '/trpc' })).listen(3000);
```

- Internally, the core requires platform services (`Context.Service`) such as:
  - `HttpPlatform`: body streaming, upgrade hooks;
  - `SocketPlatform`: WebSocket/MessagePort abstraction;
  - optionally `Clock` and `Random` (Effect built-ins).
- Each subpath provides them with a Layer (`NodePlatform.layer`, `WebPlatform.layer`, `TestPlatform.layer`). Promise users never see this. Effect users can provide their own.
- ✅ Platform-agnostic core, no extra dependencies, and stable internals that we control.
- ❌ We maintain the conversion code (Node `IncomingMessage` ↔ `Request`, as today).

### P-B — Build on `effect/http` and `@effect/platform-*`

Routes become `HttpRouter` entries. Serving uses `NodeHttpServer.layer` / `BunHttpServer.layer`, and `HttpEffect.toWebHandler` handles fetch platforms.

- ✅ Reuses Effect's server stack. Effect users mount tRPC directly into their `HttpRouter`.
- ❌ `effect/http` is `@stability unstable` (breaking changes in minors).
- ❌ `@effect/platform-node` adds `undici` and `@effect/platform-node-shared`, which violates "Effect is the only dependency" in spirit.
- ❌ Larger bundles and cold starts on edge runtimes.

### P-C — Hybrid

P-A for the core, plus `toHttpApp(handler)` / `HttpRouter` interop in `./effect` for Effect users.

## Adapters for v1 (proposed)

| Adapter                                       | API                                                           | Notes                                                          |
| --------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Fetch (Bun, Deno, CF, Vercel, Next, Hono)     | `handler.fetch` / `handler.handle`                            | Core                                                           |
| Node `http`/`https`/`http2`, Express, Connect | `toNodeListener(handler, opts)`                               | Express is plain middleware usage; no separate adapter         |
| Standalone Node server                        | `createServer(handler, { port })`                             | Convenience                                                    |
| Fastify                                       | `fastifyPlugin(handler)`                                      | **Open:** v1 or later                                          |
| AWS Lambda (API Gateway v1/v2, Function URLs) | `toLambdaHandler(handler)`                                    | **Open:** v1 or later                                          |
| WebSocket                                     | `handler.websocket(socket, { request })`                      | Standard `WebSocket` interface: works with `ws`, Bun, Deno, CF |
| Cloudflare hibernation                        | `handler.websocketMessage(ws, data)` + serialized attachments | Stateless message processing (10, 14)                          |
| MessagePort (Electron, workers, iframes)      | `handler.messagePort(port)` + `messagePortLink`               | Same message model as WebSocket                                |

## Recommendation

**P-A**, with **P-C**'s `effect/http` interop as an optional extra in `./effect`. Create the handler once, then call `fetch`/`handle`. The WebSocket handler takes a standard `WebSocket`-shaped object, so `ws` is not a dependency.

## Questions for Alex

- **Q12.1** Platform strategy: own core + Layers (P-A), `effect/http` + `@effect/platform-*` (P-B), or hybrid (P-C)?
- **Q12.2** Handler API: create once (`createHandler()` → `fetch`/`handle`), or v11's per-request `fetchRequestHandler({ req, … })`?
- **Q12.3** Which adapters are in v1? (Fetch, Node and WebSocket are proposed as must-haves; Fastify, Lambda, Cloudflare hibernation and MessagePort are candidates.)
- **Q12.4** WebSocket handler takes a standard `WebSocket` interface (no `ws` dependency)?

## Decision

- **Q12.1:** [ ] P-A · [ ] P-B · [ ] P-C
- **Q12.2:** [ ] create once · [ ] per request
- **Q12.3:** [ ] Fastify · [ ] Lambda · [ ] CF hibernation · [ ] MessagePort · [ ] Next (dedicated) · other: `____`
- **Q12.4:** [ ] yes · [ ] no
- **Notes:**
