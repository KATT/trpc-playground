# 0006 — Fetch-streamed SSE instead of `EventSource`, following the SSE standard

| Proposal                                             | Date       | Status   | Supersedes | Superseded by |
| ---------------------------------------------------- | ---------- | -------- | ---------- | ------------- |
| [14](../proposals/14-subscriptions-and-streaming.md) | 2026-10-09 | accepted | —          | —             |

## Decision

- **Q14.5:** "hell yes, but follow the sse standards" — the client reads SSE with `fetch` streaming, not `EventSource`. The wire format conforms to the [WHATWG HTML "Server-sent events"](https://html.spec.whatwg.org/multipage/server-sent-events.html) event-stream format.

## Rationale

`fetch` gives headers, POST bodies and abort natively, so no polyfill (v11 needs one for headers). Conforming to the standard keeps the stream readable by any SSE client, including a plain `EventSource`, `curl`, proxies and other languages.

Concretely, from the spec:

- `content-type: text/event-stream`, UTF-8.
- Fields `event:`, `data:`, `id:`, `retry:`; events end with a blank line; multi-line payloads use several `data:` lines.
- Keep-alive pings are comment lines (`: ping`), not custom events.
- Resume with the `Last-Event-ID` request header, set from the last `id:`.
- The client parser follows the spec's parsing rules (BOM, `\r\n`/`\r`/`\n` line endings, a single leading space after the colon).

## Rejected alternatives

- `EventSource` with a polyfill for headers (v11).
- A custom framing that only our client understands.

## Parity impact

None (Streaming response (SSE) row unchanged).

## Follow-ups

- [ ] 10's SSE section: specify the event mapping (which `event:` names, if any, for data, errors and stream end) within the standard's fields.
- [ ] Test the server output against a spec-conformant parser and a real `EventSource`.
