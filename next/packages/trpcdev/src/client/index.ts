/**
 * The tRPC client: a typed proxy over a chain of links.
 *
 * @example
 * ```ts
 * import { createTRPCClient, httpLink, safe } from 'trpcdev/client';
 * import type { AppRouter } from './server';
 *
 * const client = createTRPCClient<AppRouter>({
 *   links: [httpLink({ url: 'http://localhost:3000/trpc' })],
 * });
 * const [post, error] = await safe(client.post.byId.query({ id: '1' }));
 * ```
 * @module
 */
export {
  createSafeClient,
  createTRPCClient,
  createUntypedClient,
  safe,
  type SafeClient,
  type SafeResult,
  type TRPCClientOptions,
  type TRPCUntypedClient,
  type TypedClientOptions,
} from './client.ts';
export {
  link,
  type AnyLink,
  type DeclContext,
  type EffectLinkOpts,
  type LinkDecl,
  type Operation,
  type OperationStream,
  type PromiseLinkOpts,
  type TRPCClientContext,
  type TRPCLink,
} from './link.ts';
export {
  dedupeLink,
  loggerLink,
  retryLink,
  splitLink,
  type DedupeContext,
  type DedupeLinkOptions,
  type LoggerEvent,
  type RetryLinkOptions,
  type SplitLinkOptions,
} from './links/basic.ts';
export { httpLink, type HTTPLinkOptions } from './links/http.ts';
export { localLink, type LocalLinkOptions } from './links/local.ts';
export {
  messagePortLink,
  wsLink,
  type MessagePortLinkOptions,
  type SocketLink,
  type SocketLinkOptions,
  type WebSocketLinkOptions,
} from './links/socket.ts';
export {
  routerType,
  type CallOptions,
  type ClientError,
  type DecorateProcedure,
  type DefinedError,
  type LinksContext,
  type RouterOf,
  type RouterPaths,
  type RouterType,
  type SubscribeOptions,
  type TRPCClient,
  type TRPCPromise,
  type TRPCSubscription,
  type UnexpectedError,
} from './types.ts';
export type { MessagePortLike } from '../server/socket.ts';
export {
  ERROR_STATUS,
  isDefinedError,
  isTRPCError,
  TRPCError,
  type AnyTRPCError,
  type BuiltinErrorCode,
  type TRPCErrorOptions,
} from '../internal/error.ts';
export type { Deserialized } from '../internal/types.ts';
