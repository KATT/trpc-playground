import type { BuiltinErrorCode, TRPCError } from '../internal/error.ts';
import type { AnyProcedure, Procedure } from '../server/procedure.ts';
import type { TRPCClientContext } from './link.ts';

/**
 * A typed (`defined`) error from a procedure's union.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type DefinedError<E> =
  E extends TRPCError<infer C, infer D>
    ? TRPCError<C, D> & { readonly defined: true }
    : never;

/**
 * Anything outside the typed union: thrown errors, masked internal errors,
 * network failures (`NETWORK_ERROR`) and aborts (`CLIENT_CLOSED_REQUEST`).
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type UnexpectedError = TRPCError<
  BuiltinErrorCode | (string & {}),
  unknown
> & { readonly defined: false };

/**
 * What a call can fail with. Narrow with `error.defined` first, then `code`.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type ClientError<E> = DefinedError<E> | UnexpectedError;

/**
 * A call's `Promise`, carrying its error type for `safe()`.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface TRPCPromise<T, E> extends Promise<T> {
  readonly '~error'?: E;
}

/**
 * A subscription: iterate it with `for await`. Breaking out of the loop, or
 * aborting `signal`, closes the connection.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface TRPCSubscription<T, E> extends AsyncIterable<T> {
  readonly '~error'?: E;
}

/**
 * Options for `query()` and `mutate()` (16 CS-A).
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface CallOptions {
  signal?: AbortSignal | undefined;
  /** Read by links (17 F-B). */
  context?: TRPCClientContext | undefined;
}

/**
 * Options for `subscribe()`.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface SubscribeOptions extends CallOptions {
  /** Resume after this `tracked()` event id. */
  lastEventId?: string | undefined;
}

/** @internal */
export type CallArgs<TInput, TOpts> = undefined extends TInput
  ? [input?: TInput, opts?: TOpts]
  : [input: TInput, opts?: TOpts];

/**
 * The client methods for one procedure.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type DecorateProcedure<P> =
  P extends Procedure<infer D>
    ? D['type'] extends 'query'
      ? {
          query(
            ...args: CallArgs<D['input'], CallOptions>
          ): TRPCPromise<D['output'], ClientError<D['errors']>>;
        }
      : D['type'] extends 'mutation'
        ? {
            mutate(
              ...args: CallArgs<D['input'], CallOptions>
            ): TRPCPromise<D['output'], ClientError<D['errors']>>;
          }
        : {
            subscribe(
              ...args: CallArgs<D['input'], SubscribeOptions>
            ): TRPCSubscription<D['output'], ClientError<D['errors']>>;
          }
    : never;

/**
 * The typed client for a router.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type TRPCClient<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends AnyProcedure
    ? DecorateProcedure<TRouter[K]>
    : TRPCClient<TRouter[K]>;
};
