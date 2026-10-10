import type { AnyTRPCError } from '../internal/error.ts';
import type { MaybePromise, ProcedureType } from '../internal/types.ts';

/**
 * What `next()` resolves to. `'~ctx'` is a phantom that carries the ctx the
 * middleware added, so the builder can infer it.
 *
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type MiddlewareResult<TCtx> = (
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: AnyTRPCError }
) & { readonly '~ctx'?: TCtx };

/**
 * Calls the rest of the chain, optionally extending `ctx`.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface NextFn {
  (): Promise<MiddlewareResult<{}>>;
  <$Ctx extends object>(opts: { ctx: $Ctx }): Promise<MiddlewareResult<$Ctx>>;
}

/**
 * The options a middleware receives.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface MiddlewareOpts<TCtx, TInput, TMeta> {
  readonly ctx: TCtx;
  /** The input parsed so far: inputs declared after this middleware are not in it. */
  readonly input: TInput;
  readonly meta: TMeta;
  /** `'post.byId'` */
  readonly path: string;
  readonly type: ProcedureType;
  /** Aborted when the client goes away. */
  readonly signal: AbortSignal;
  readonly next: NextFn;
}

/**
 * A middleware: calls `next()` (optionally extending `ctx`) or returns a
 * `TRPCError` to short-circuit. A returned error joins the procedure's typed
 * error union.
 *
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type MiddlewareFunction<
  TCtx,
  TInput,
  TMeta,
  $Ctx extends object,
  $Err extends AnyTRPCError,
> = (
  opts: MiddlewareOpts<TCtx, TInput, TMeta>,
) => MaybePromise<MiddlewareResult<$Ctx> | $Err>;

/**
 * What a standalone middleware needs from the procedure it is used on.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface MiddlewareRequirements {
  ctx?: object;
  meta?: object;
  input?: unknown;
}

type ReqCtx<T extends MiddlewareRequirements> = T['ctx'] extends object
  ? T['ctx']
  : {};
type ReqMeta<T extends MiddlewareRequirements> = T['meta'] extends object
  ? T['meta']
  : {};
type ReqInput<T extends MiddlewareRequirements> = 'input' extends keyof T
  ? T['input']
  : unknown;

/**
 * Declares a middleware outside any `t`, typed by what it needs. `.use()`
 * checks those needs against the procedure, so the same middleware can be
 * published in its own package.
 *
 * @example
 * ```ts
 * export const requireUser = middleware<{ ctx: { user: User | null } }>()(
 *   ({ ctx, next }) =>
 *     ctx.user
 *       ? next({ ctx: { user: ctx.user } })
 *       : error({ code: 'UNAUTHORIZED' }),
 * );
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function middleware<TReq extends MiddlewareRequirements = {}>(): <
  $Ctx extends object = {},
  $Err extends AnyTRPCError = never,
>(
  fn: MiddlewareFunction<
    ReqCtx<TReq>,
    ReqInput<TReq>,
    ReqMeta<TReq>,
    $Ctx,
    $Err
  >,
) => MiddlewareFunction<
  ReqCtx<TReq>,
  ReqInput<TReq>,
  ReqMeta<TReq>,
  $Ctx,
  $Err
> {
  return (fn) => fn;
}
