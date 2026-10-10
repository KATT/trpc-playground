/**
 * TS2742 portability fixture: everything exported here must be nameable in
 * emitted `.d.ts` files under pnpm isolation. `pnpm typecheck` emits
 * declarations into `dist/`, which fails on an unnameable type.
 *
 * @see ../../.agent-docs/proposals/01-packages-and-type-portability.md
 */
import { Context, Effect, Layer, Schema, Stream } from 'effect';
import { createTRPCClient, httpLink, link, localLink } from 'trpcdev/client';
import { createEffectClient } from 'trpcdev/effect';
import {
  createFetchHandler,
  createRouterClient,
  error,
  initTRPC,
  mergeRouters,
  middleware,
  tracked,
} from 'trpcdev/server';
import { createSerializer } from 'trpcdev/serializer';
import { z } from 'zod';

interface User {
  id: string;
  name: string;
}

class PostRepo extends Context.Service<
  PostRepo,
  { find: (id: string) => Effect.Effect<{ id: string; title: string } | null> }
>()('PostRepo') {}

export const PostRepoLive = Layer.succeed(PostRepo, {
  find: (id) => Effect.succeed(id === '1' ? { id, title: 'Hello' } : null),
});

export const t = initTRPC<{
  ctx: { user: User | null };
  meta: { scope?: string };
}>();

export const publicProcedure = t.procedure;

export const authed = t.procedure.use(({ ctx, next }) =>
  ctx.user
    ? next({ ctx: { user: ctx.user } })
    : error({ code: 'UNAUTHORIZED' }),
);

export const timed = t.middleware(async ({ next }) => next());

export const requireAdmin = middleware<{ ctx: { user: User } }>()(
  ({ ctx, next }) =>
    ctx.user.id === 'admin' ? next() : error({ code: 'FORBIDDEN' }),
);

const pluginT = initTRPC<{ ctx: { user: User } }>();
export const orgPlugin = pluginT.procedure
  .input(z.object({ orgId: z.string() }))
  .use(({ input, next }) => next({ ctx: { orgId: input.orgId } }));

export const postRouter = {
  byId: t.procedure
    .input(Schema.Struct({ id: Schema.String }))
    .query(({ input }) =>
      Effect.gen(function* () {
        const post = yield* (yield* PostRepo).find(input.id);
        if (!post) {
          return yield* error({ code: 'NOT_FOUND', data: { id: input.id } });
        }
        return post;
      }),
    ),
  create: authed
    .use(requireAdmin)
    .concat(orgPlugin)
    .input(z.object({ title: z.string() }))
    .mutation(({ ctx, input }) => ({ ...input, orgId: ctx.orgId })),
  feed: t.procedure.query(() => ({
    first: 'a',
    rest: (async function* () {
      yield 'b';
    })(),
  })),
  onPost: t.procedure.subscription(async function* () {
    yield tracked('1', { id: '1' });
  }),
  ticks: t.procedure.subscription(() => Stream.make(1, 2, 3)),
};

export const appRouter = mergeRouters(postRouter, {
  health: publicProcedure.query(() => 'ok' as const),
});
export type AppRouter = typeof appRouter;

export const serializer = createSerializer();

export const handler = createFetchHandler({
  router: appRouter,
  createContext: () => ({ user: null }),
  layer: PostRepoLive,
});

export const client = createTRPCClient<AppRouter>({
  links: [link(async ({ op, next }) => next(op)), httpLink({ url: '/trpc' })],
});

export const localClient = createTRPCClient<AppRouter>({
  links: [localLink({ router: appRouter, layer: PostRepoLive })],
});

export const effectClient = createEffectClient<AppRouter>({
  links: [httpLink({ url: '/trpc' })],
});

export const caller = createRouterClient(appRouter, {
  ctx: { user: null },
  layer: PostRepoLive,
});
