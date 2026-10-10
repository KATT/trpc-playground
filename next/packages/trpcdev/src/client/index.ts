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
} from './client.ts';
export {
  link,
  type EffectLinkOpts,
  type Operation,
  type OperationStream,
  type PromiseLinkOpts,
  type TRPCClientContext,
  type TRPCLink,
} from './link.ts';
export {
  loggerLink,
  retryLink,
  splitLink,
  type LoggerEvent,
  type RetryLinkOptions,
  type SplitLinkOptions,
} from './links/basic.ts';
export { httpLink, type HTTPLinkOptions } from './links/http.ts';
export { localLink, type LocalLinkOptions } from './links/local.ts';
export type {
  CallOptions,
  ClientError,
  DecorateProcedure,
  DefinedError,
  SubscribeOptions,
  TRPCClient,
  TRPCPromise,
  TRPCSubscription,
  UnexpectedError,
} from './types.ts';
export {
  ERROR_STATUS,
  isDefinedError,
  isTRPCError,
  TRPCError,
  type AnyTRPCError,
  type BuiltinErrorCode,
  type TRPCErrorOptions,
} from '../internal/error.ts';
