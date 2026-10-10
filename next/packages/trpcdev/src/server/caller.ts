import { Effect, Exit, type Layer } from 'effect';
import { createTRPCClient } from '../client/client.ts';
import { localLink } from '../client/links/local.ts';
import type { TRPCClient } from '../client/types.ts';
import type { MaybePromise } from '../internal/types.ts';
import { callProcedure, normalizeCause } from './execute.ts';
import type { Procedure, ProcedureDef } from './procedure.ts';
import type {
  AnyRouter,
  inferRouterContext,
  inferRouterServices,
} from './router.ts';

type CtxOption<TCtx> = {} extends TCtx
  ? { ctx?: TCtx | (() => MaybePromise<TCtx>) }
  : { ctx: TCtx | (() => MaybePromise<TCtx>) };

type ServicesOption<TServices> = [TServices] extends [never]
  ? { layer?: Layer.Layer<any, any, never> }
  : { layer: Layer.Layer<TServices, any, never> };

/**
 * Options for {@link createRouterClient}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type RouterClientOptions<TRouter extends AnyRouter> = CtxOption<
  inferRouterContext<TRouter>
> &
  ServicesOption<inferRouterServices<TRouter>>;

/**
 * Calls a router in-process with the same shape as the HTTP client (15
 * SC-A). Values are passed by reference, not serialized.
 *
 * @example
 * ```ts
 * const caller = createRouterClient(appRouter, { ctx: { user } });
 * const post = await caller.post.byId.query({ id: '1' });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function createRouterClient<TRouter extends AnyRouter>(
  router: TRouter,
  ...[opts]: {} extends RouterClientOptions<TRouter>
    ? [opts?: RouterClientOptions<TRouter>]
    : [opts: RouterClientOptions<TRouter>]
): TRPCClient<TRouter> {
  const o = (opts ?? {}) as {
    ctx?: object | (() => MaybePromise<object>);
    layer?: Layer.Layer<any, any, never>;
  };
  const ctx = o.ctx;
  return createTRPCClient<TRouter>({
    links: [
      localLink({
        router,
        layer: o.layer,
        serializer: false,
        createContext: (typeof ctx === 'function'
          ? ctx
          : () => ctx ?? {}) as () => never,
      }),
    ],
  });
}

/**
 * Calls one procedure directly. Throws the procedure's `TRPCError`s.
 *
 * @example
 * ```ts
 * const post = await call(byId, { id: '1' }, { ctx: { user } });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export async function call<TDef extends ProcedureDef>(
  procedure: Procedure<TDef>,
  input: TDef['input'],
  opts: { ctx: TDef['ctx']; signal?: AbortSignal; path?: string },
): Promise<TDef['output']> {
  const exit = await Effect.runPromiseExit(
    callProcedure({
      procedure,
      path: opts.path ?? '',
      ctx: opts.ctx,
      input,
      signal: opts.signal ?? new AbortController().signal,
    }) as Effect.Effect<TDef['output'], never, never>,
    { signal: opts.signal },
  );
  if (Exit.isSuccess(exit)) return exit.value;
  throw normalizeCause(exit.cause);
}
