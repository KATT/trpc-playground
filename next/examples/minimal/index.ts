/**
 * Minimal example: a router served over `node:http`, called with the typed
 * client. Run with `pnpm example`.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTRPCClient, httpLink, safe } from 'trpcdev/client';
import { toNodeListener } from 'trpcdev/node';
import { createFetchHandler, error, initTRPC, tracked } from 'trpcdev/server';
import { z } from 'zod';

// --- server --------------------------------------------------------------------------

interface Post {
  id: string;
  title: string;
}
const posts = new Map<string, Post>([['1', { id: '1', title: 'Hello v12' }]]);

const t = initTRPC<{ ctx: { user: string | null } }>();

const authed = t.procedure.use(({ ctx, next }) =>
  ctx.user
    ? next({ ctx: { user: ctx.user } })
    : error({ code: 'UNAUTHORIZED', message: 'Send an authorization header' }),
);

const appRouter = {
  post: {
    byId: t.procedure
      .input(z.object({ id: z.string() }))
      .query(
        ({ input }) =>
          posts.get(input.id) ??
          error({ code: 'NOT_FOUND', data: { id: input.id } }),
      ),
    create: authed
      .input(z.object({ title: z.string().min(1) }))
      .mutation(({ input }) => {
        const post = { id: String(posts.size + 1), title: input.title };
        posts.set(post.id, post);
        return post;
      }),
    all: t.procedure.subscription(async function* () {
      for (const post of posts.values()) yield tracked(post.id, post);
    }),
  },
};
export type AppRouter = typeof appRouter;

const handler = createFetchHandler({
  router: appRouter,
  batch: true,
  createContext: ({ request }) => ({
    user: request.headers.get('authorization'),
  }),
});
const server = createServer(toNodeListener(handler));
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address() as AddressInfo;

// --- client --------------------------------------------------------------------------

const client = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `http://127.0.0.1:${port}/trpc`,
      batch: true,
      headers: { authorization: 'alex' },
    }),
  ],
});

const post = await client.post.byId.query({ id: '1' });
console.log('post.byId:', post);

const created = await client.post.create.mutate({ title: 'Typed errors' });
console.log('post.create:', created);

const [, err] = await safe(client.post.byId.query({ id: '404' }));
if (err?.defined && err.code === 'NOT_FOUND') {
  console.log('post.byId failed: no post', err.data.id);
}

for await (const event of client.post.all.subscribe()) {
  console.log('post.all event', event.id, event.data.title);
}

server.close();
await handler.dispose();
