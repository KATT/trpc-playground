/**
 * Serve a fetch handler with `node:http`, including WebSocket upgrades.
 *
 * @example
 * ```ts
 * import { createServer } from 'node:http';
 * import { createFetchHandler } from 'trpcdev/server';
 * import { toNodeListener, toNodeUpgradeListener } from 'trpcdev/node';
 *
 * const handler = createFetchHandler({ router });
 * createServer(toNodeListener(handler))
 *   .on('upgrade', toNodeUpgradeListener(handler))
 *   .listen(3000);
 * ```
 * @module
 */
/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, type Duplex } from 'node:stream';
import type { WebSocketLike } from '../server/socket.ts';
import {
  acceptWebSocket,
  rejectUpgrade,
  type AcceptWebSocketOptions,
} from './websocket.ts';

export {
  acceptWebSocket,
  NodeWebSocket,
  type AcceptWebSocketOptions,
} from './websocket.ts';

/**
 * Anything with a web-standard `fetch` method, like `createFetchHandler()`.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface FetchLike {
  fetch(request: Request): Promise<Response>;
}

/**
 * Converts a Node request to a web `Request`. The request's signal aborts
 * when the client disconnects.
 *
 * @example
 * ```ts
 * const request = toWebRequest(req, res);
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function toWebRequest(
  req: IncomingMessage,
  res: ServerResponse | Duplex,
): Request {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`,
  );
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else headers.set(key, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    signal: controller.signal,
    ...(hasBody
      ? {
          body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
          duplex: 'half',
        }
      : {}),
  } as RequestInit);
}

/**
 * Writes a web `Response` to a Node response, flushing each chunk as it
 * arrives (needed for SSE and JSONL streaming).
 *
 * @example
 * ```ts
 * await writeWebResponse(res, await handler.fetch(request));
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export async function writeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) {
    if (key === 'set-cookie') continue;
    res.setHeader(key, value);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  if (!response.body) {
    res.end();
    return;
  }
  res.flushHeaders();
  const reader = response.body.getReader();
  const cancel = () => void reader.cancel().catch(() => {});
  res.on('close', cancel);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch {
    res.destroy();
  } finally {
    res.off('close', cancel);
  }
}

/**
 * Adapts a fetch handler to a `node:http` request listener.
 *
 * @example
 * ```ts
 * createServer(toNodeListener(handler)).listen(3000);
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function toNodeListener(
  handler: FetchLike,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void (async () => {
      try {
        await writeWebResponse(
          res,
          await handler.fetch(toWebRequest(req, res)),
        );
      } catch {
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      }
    })();
  };
}

/**
 * Something that serves WebSockets, like `createFetchHandler()`.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface WebSocketHandlerLike {
  websocket(socket: WebSocketLike, opts: { request: Request }): void;
}

/**
 * Options for {@link toNodeUpgradeListener}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface NodeUpgradeOptions extends AcceptWebSocketOptions {
  /**
   * Only upgrade requests to this path; others get a 404.
   * @default '/trpc'
   */
  endpoint?: string;
  /**
   * Accept the upgrade only when this returns true. Browsers send cookies
   * with cross-site WebSocket requests, so check `origin` when you
   * authenticate with cookies.
   */
  allowOrigin?: (origin: string | undefined) => boolean;
}

/**
 * Adapts a handler to `node:http`'s `upgrade` event: accepts WebSockets on
 * the endpoint and serves calls over them (10).
 *
 * @example
 * ```ts
 * server.on('upgrade', toNodeUpgradeListener(handler, {
 *   allowOrigin: (origin) => origin === 'https://app.example.com',
 * }));
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function toNodeUpgradeListener(
  handler: WebSocketHandlerLike,
  opts: NodeUpgradeOptions = {},
): (req: IncomingMessage, socket: Duplex, head: Buffer) => void {
  const endpoint = `/${(opts.endpoint ?? '/trpc').replace(/^\/+|\/+$/g, '')}`;
  return (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname !== endpoint && pathname !== `${endpoint}/`) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    if (opts.allowOrigin && !opts.allowOrigin(req.headers.origin)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }
    const request = toWebRequest(req, socket);
    const ws = acceptWebSocket(req, socket, head, opts);
    if (ws) handler.websocket(ws, { request });
  };
}
