/**
 * Effect-native client: calls return an `Effect`, subscriptions a `Stream`.
 * The server side of Effect (Effect resolvers, `.provide()`, Effect Schema
 * inputs, the handler's `layer`) lives in `trpcdev/server`.
 *
 * @example
 * ```ts
 * import { createEffectClient } from 'trpcdev/effect';
 *
 * const client = createEffectClient<AppRouter>({ links: [httpLink({ url })] });
 * const program = Effect.gen(function* () {
 *   const post = yield* client.post.byId.query({ id: '1' });
 * });
 * ```
 * @module
 */
import type { Effect } from 'effect';
import { Stream } from 'effect';
import { createRecursiveProxy, makeOperation } from '../client/client.ts';
import type { TRPCClientOptions } from '../client/client.ts';
import { firstValue, link, runLinks } from '../client/link.ts';
import type {
  CallArgs,
  CallOptions,
  ClientError,
  SubscribeOptions,
} from '../client/types.ts';
import type { Deserialized } from '../internal/types.ts';
import type { AnyProcedure, Procedure } from '../server/procedure.ts';

export { link };

/**
 * The Effect client methods for one procedure.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type DecorateEffectProcedure<P> =
  P extends Procedure<infer D>
    ? D['type'] extends 'query'
      ? {
          query(
            ...args: CallArgs<D['input'], CallOptions>
          ): Effect.Effect<Deserialized<D['output']>, ClientError<D['errors']>>;
        }
      : D['type'] extends 'mutation'
        ? {
            mutate(
              ...args: CallArgs<D['input'], CallOptions>
            ): Effect.Effect<
              Deserialized<D['output']>,
              ClientError<D['errors']>
            >;
          }
        : {
            subscribe(
              ...args: CallArgs<D['input'], SubscribeOptions>
            ): Stream.Stream<
              Deserialized<D['output']>,
              ClientError<D['errors']>
            >;
          }
    : never;

/**
 * The Effect client for a router.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type EffectClient<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends AnyProcedure
    ? DecorateEffectProcedure<TRouter[K]>
    : EffectClient<TRouter[K]>;
};

const METHODS = {
  query: 'query',
  mutate: 'mutation',
  subscribe: 'subscription',
} as const;

/**
 * Creates a client whose calls are Effects. Interrupting the fiber aborts the
 * request.
 *
 * @example
 * ```ts
 * const client = createEffectClient<AppRouter>({ links: [httpLink({ url })] });
 * const post = yield* client.post.byId.query({ id: '1' }).pipe(
 *   Effect.catchIf((e) => e.defined && e.code === 'NOT_FOUND', () => Effect.succeed(null)),
 * );
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function createEffectClient<TRouter>(
  opts: TRPCClientOptions,
): EffectClient<TRouter> {
  return createRecursiveProxy((path, args) => {
    const method = path.at(-1) as keyof typeof METHODS | undefined;
    const type = method ? METHODS[method] : undefined;
    if (!type) {
      throw new TypeError(
        `Call .query(), .mutate() or .subscribe() on a procedure, not ${path.join('.')}()`,
      );
    }
    const [input, callOpts] = args as [unknown, SubscribeOptions | undefined];
    const op = makeOperation(
      type,
      path.slice(0, -1).join('.'),
      input,
      callOpts,
    );
    const stream = Stream.suspend(() => runLinks(opts.links, op));
    return type === 'subscription' ? stream : firstValue(stream);
  });
}
