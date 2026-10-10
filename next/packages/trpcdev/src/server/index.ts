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
  InputDef,
  InputOpts,
  ProcedureBuilder,
  ProvideOpts,
  ResolverOpts,
  Split,
  SplitReturn,
  SplitStream,
  SubscriptionResolverOpts,
  With,
} from './builder.ts';
export {
  middleware,
  type MiddlewareFunction,
  type MiddlewareOpts,
  type MiddlewareRequirements,
  type MiddlewareResult,
  type NextFn,
} from './middleware.ts';
export {
  isProcedure,
  type AnyProcedure,
  type inferProcedureErrors,
  type inferProcedureInput,
  type inferProcedureOutput,
  type Procedure,
  type ProcedureDef,
  type ProcedureInternals,
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
