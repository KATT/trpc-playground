/**
 * Define procedures and routers, and serve them.
 *
 * @example
 * ```ts
 * import { createFetchHandler, error, initTRPC } from 'trpcdev/server';
 * import { z } from 'zod';
 *
 * const t = initTRPC<{ ctx: { user: User | null } }>();
 *
 * export const appRouter = {
 *   post: {
 *     byId: t.procedure
 *       .input(z.object({ id: z.string() }))
 *       .query(async ({ input }) =>
 *         (await db.post.find(input.id)) ?? error({ code: 'NOT_FOUND' }),
 *       ),
 *   },
 * };
 * export type AppRouter = typeof appRouter;
 *
 * export default createFetchHandler({
 *   router: appRouter,
 *   createContext: ({ request }) => ({ user: getUser(request) }),
 * });
 * ```
 * @module
 */
export {
  initTRPC,
  type RootConfig,
  type RootDef,
  type RootMiddleware,
  type RootOptions,
  type TRPCRoot,
} from './init.ts';
export type {
  AnyProcedureBuilder,
  BuilderDef,
  BuilderInternals,
  BuildProcedure,
  ConcatCheck,
  CurrentCtx,
  DeclaredErrors,
  ErrorConstructorOpts,
  ErrorConstructors,
  ErrorMapInput,
  InputDef,
  InputOpts,
  ProcedureBuilder,
  ProvideOpts,
  ResolverOpts,
  ShortsCheck,
  Split,
  SplitReturn,
  SplitStream,
  StrictErrors,
  SubscriptionResolverOpts,
  With,
} from './builder.ts';
export {
  middleware,
  ok,
  onError,
  onFinish,
  onStart,
  onSuccess,
  type EffectBodyCheck,
  type EffectMiddleware,
  type EffectMiddlewareDecl,
  type EffectMiddlewareFactory,
  type EffectMiddlewareOpts,
  type EffectNextFn,
  type MiddlewareFunction,
  type MiddlewareOpts,
  type MiddlewareRequirements,
  type MiddlewareResult,
  type NextFn,
  type OkResult,
  type ReqCtx,
  type ReqInput,
  type ReqMeta,
  type ResponseHandle,
} from './middleware.ts';
export {
  isProcedure,
  type AnyProcedure,
  type ErrorMap,
  type ErrorSpec,
  type inferProcedureErrors,
  type inferProcedureInput,
  type inferProcedureOutput,
  type Procedure,
  type ProcedureDef,
  type ProcedureInternals,
  type Route,
  type Step,
} from './procedure.ts';
export {
  mergeRouters,
  type AnyRouter,
  type inferRouterContext,
  type inferRouterErrors,
  type inferRouterInputs,
  type inferRouterOutputs,
  type inferRouterServices,
} from './router.ts';
export type {
  AnySchema,
  InputValidationError,
  InputValidationErrorData,
  StandardIssue,
  StandardSchemaV1,
} from './schema.ts';
export { tracked, type TrackedEnvelope } from './tracked.ts';
export {
  createFetchHandler,
  type BaseHandlerOptions,
  type CreateContextOpts,
  type FetchHandler,
  type FetchHandlerOptions,
  type OnErrorOpts,
} from './fetch.ts';
export {
  call,
  createRouterClient,
  type CallOptions,
  type RouterClientOptions,
} from './caller.ts';
export {
  ERROR_STATUS,
  error,
  isDefinedError,
  isTRPCError,
  TRPCError,
  type AnyTRPCError,
  type BuiltinErrorCode,
  type TRPCErrorOptions,
} from '../internal/error.ts';
export type { ProcedureType, TypeError, Unset } from '../internal/types.ts';
