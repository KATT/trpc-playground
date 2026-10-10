/**
 * Helpers for testing routers over real HTTP.
 *
 * @example
 * ```ts
 * await using server = await createTestServer({ router: appRouter });
 * const client = createTRPCClient<AppRouter>({ links: [httpLink({ url: server.url })] });
 * ```
 * @module
 */
/// <reference types="node" />
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toNodeListener } from '../node/index.ts';
import {
  createFetchHandler,
  type FetchHandler,
  type FetchHandlerOptions,
} from '../server/fetch.ts';
import type { AnyRouter } from '../server/router.ts';

/**
 * A running test server.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface TestServer extends AsyncDisposable {
  /** The endpoint URL, e.g. `http://127.0.0.1:54321/trpc`. */
  readonly url: string;
  readonly handler: FetchHandler;
  readonly server: Server;
  /** Requests the server has received, in order. */
  readonly requests: ReadonlyArray<{
    method: string;
    url: string;
    headers: Headers;
  }>;
  /** Closes open connections, stops the server and disposes the handler. */
  close(): Promise<void>;
}

/**
 * Starts a `node:http` server for a router on a free port.
 *
 * @example
 * ```ts
 * await using server = await createTestServer({ router, batch: true });
 * await fetch(`${server.url}/health`);
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export async function createTestServer<TRouter extends AnyRouter>(
  opts: FetchHandlerOptions<TRouter>,
): Promise<TestServer> {
  const handler = createFetchHandler(opts);
  const requests: { method: string; url: string; headers: Headers }[] = [];
  const recording = {
    fetch(request: Request) {
      requests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
      });
      return handler.fetch(request);
    },
  };
  const server = createServer(toNodeListener(recording));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const endpoint = (opts.endpoint ?? '/trpc').replace(/^\/+|\/+$/g, '');
  const close = async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await handler.dispose();
  };
  return {
    url: `http://127.0.0.1:${port}/${endpoint}`,
    handler,
    server,
    requests,
    close,
    [Symbol.asyncDispose]: close,
  };
}
