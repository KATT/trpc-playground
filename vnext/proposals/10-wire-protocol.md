# 10 — Wire protocol

| Status     | Area                     | Depends on | oRPC parity rows                                                               |
| ---------- | ------------------------ | ---------- | ------------------------------------------------------------------------------ |
| `proposed` | server, client, adapters | 04, 07, 11 | Batch requests, Streaming (SSE), WebSockets, **Message Port**, OpenAPI support |

## Summary

Decide the RPC wire format over HTTP, streaming, WebSockets and message ports: URLs, methods, envelopes, errors, batching, versioning and secure defaults.

**Recommendation:** a new, simpler protocol.

- Path-based URLs.
- GET for queries, POST for mutations.
- No envelope when using plain JSON.
- HTTP status codes for errors.
- Opt-in batching with streamed responses.
- One message model shared by WebSocket and MessagePort.
- A `trpc-version` header from day one.

This is separate from the OpenAPI endpoint (18), which maps procedures to REST.

## Today (v11)

- **URLs:** `GET /trpc/post.byId?input=…` and `POST /trpc/post.create`.
- **Batching:** `?batch=1` with comma-joined paths (`/trpc/a,b?batch=1&input={"0":…,"1":…}`). Responses are an array of `{ result: { data } } | { error }`, or JSONL when using `httpBatchStreamLink`.
- **Envelopes:** `{ result: { data } }` on success, `{ error: { message, code, data } }` on error. The transformer wraps both.
- **Streaming:** JSONL with nested promises and iterables (chunk references), SSE for subscriptions, and a JSON-RPC-like WebSocket protocol (`{ id, method: 'subscription', params: { path, input } }`, plus `connectionParams`).
- **Pain points:**
  - The URL format is awkward for CDNs and logs (comma-joined batch paths, huge `input` query strings).
  - Envelope noise.
  - Batching is on by default. Security fixes have had to add limits later (default `maxBatchSize`, body limits).
  - The WebSocket protocol differs from HTTP.
  - There is no versioning.

## Goals

- A readable protocol that works with plain `fetch` and `curl`, CDNs and log tooling.
- One message model across HTTP, WebSocket and MessagePort, so that new transports are cheap and stateless WebSockets (hibernation) are possible.
- Secure defaults.
- Version negotiation, for future back-compat shims (`ideas.md`: "back-compat can come later via a client tRPC-version header").

## Options

### A — Keep the v11 protocol

- ✅ Old clients keep working.
- ❌ Keeps all the pain. `ideas.md` explicitly allows breaking changes, and a back-compat adapter can be added later behind the version header.

### B — New tRPC protocol (recommended)

#### Requests

| Kind                    | Request                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Query                   | `GET {base}/post/byId?id=1&tags[]=a`: legible query params (11 (c)), with `?input=<serialized>` as fallback. The client switches to `POST` (or `QUERY` later) above a URL length threshold |
| Mutation                | `POST {base}/post/create` with the serialized input as the body                                                                                                                            |
| Streamed / subscription | Same URL. `accept: text/event-stream` (SSE) or `application/jsonl` selects the stream format                                                                                               |
| Files                   | `multipart/form-data` (11)                                                                                                                                                                 |

#### Bodies and responses

- **Body:** the serialized input (11). With the default danSON-based serializer, inline markers only appear where there are non-JSON values, so most bodies read as plain JSON. **Open:** drop danSON's `{ json }` wrapper when there are no `refs`.
- **Success:** `2xx` with the serialized output and no envelope. The default status is 200; 201 and others can be set via `response.status` (04).
- **Error:** the status comes from the error (07), with body `{ error: { code, message, data, defined } }` (serialized). Clients detect errors by status ≥ 400.

#### Batching

Batching is opt-in on both server and client.

- **Request:** `POST {base}` with header `trpc-batch: 1` and body `[{ path, input, method? }, …]`.
- **Response:** `application/jsonl`, one line per call as each finishes: `{ i, status, body }`. Each call keeps its own status.
- A `maxBatchSize` default (for example 20) and a body size limit apply.

#### Streaming

- Streams use the serializer's async format (danSON: a head chunk, then `[index, status, { json }]` chunks), so a stream can be the root value or nested anywhere in an output (14 (e)).
- **JSONL:** one chunk per line.
- **SSE:** one chunk per `data:` event. `id:` comes from `tracked()` (14), and streams resume with `Last-Event-ID`.

#### WebSocket and MessagePort

One message model for both:

```ts
// client → server
{ id, type: 'request', path, input, method }
{ id, type: 'abort' }
// server → client
{ id, type: 'result', body } | { id, type: 'error', body } | { id, type: 'event', body, eventId? } | { id, type: 'done' }
```

- The first message may be `{ type: 'init', connectionParams, version }`.
- Messages are self-contained, so a hibernating server can rebuild state from storage (14).

#### Versioning

- Clients send `trpc-version: <protocol version>`; servers reply with the same header.
- A mismatch returns a typed `UNSUPPORTED_PROTOCOL` error.
- A future v11-compat handler can be selected on this header.

#### Secure defaults

- Mutations require a non-simple content type (`application/json` or a custom `trpc-*` header), which gives CSRF protection without tokens.
- GET is allowed only for queries (oRPC's "strict GET", on by default).
- Default body and batch limits. WebSocket origin allow-list.

### C — Adopt oRPC's RPC protocol verbatim

`{ json, meta }`, `/rpc/planet/create`, batch header `x-orpc-batch`.

- ✅ Interop with oRPC clients and tooling.
- ❌ Ties our evolution to theirs. Its prefixes and type codes are oRPC-specific, and there is little real user benefit.

## Recommendation

**Option B.**

- The path separator, URL thresholds and limit defaults are open questions below.
- **Open:** HTTP `QUERY` (supported by `effect/http-api`) as the long-input fallback instead of POST, once runtime support is broad.

> ⚠️ **Parity:** the message model must not assume HTTP. MessagePort, WebSocket hibernation and future transports (stdio, workers) depend on it.

## Questions for Alex

- **Q10.1** New protocol (B), keep v11 (A) or adopt oRPC's (C)?
- **Q10.2** Path separator in URLs: `/post/byId` (REST-like, oRPC) or `/post.byId` (v11)?
- **Q10.3** Long query inputs: POST fallback, the `QUERY` method, or both behind a client option?
- **Q10.4** Batching opt-in on both sides, with a streamed JSONL response?
- **Q10.5** Default stream format for queries and mutations that return iterables: JSONL or SSE? Subscriptions default to SSE either way.
- **Q10.6** Protocol version header name (`trpc-version`?) and whether servers accept _any_ older version or reject by default.

## Decision

- **Q10.1:** [ ] A · [ ] B · [ ] C
- **Q10.2:** [ ] `/` · [ ] `.`
- **Q10.3:** [ ] POST · [ ] QUERY · [ ] both
- **Q10.4:** [ ] yes · [ ] on by default
- **Q10.5:** [ ] JSONL · [ ] SSE
- **Q10.6:** header `__________` · [ ] reject unknown · [ ] best effort
- **Notes:**
