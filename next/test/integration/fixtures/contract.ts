import { contract } from 'trpcdev/contract';
import { z } from 'zod';

const c = contract.create<{ meta: { auth?: boolean } }>();

export const Post = z.object({ id: z.string(), title: z.string() });

export const postContract = {
  byId: c
    .route({ method: 'GET', path: '/posts/{id}', tags: ['posts'] })
    .input(z.object({ id: z.string() }))
    .output(Post)
    .errors({ NOT_FOUND: { data: z.object({ id: z.string() }) } })
    .query(),
  create: c
    .meta({ auth: true })
    .input(z.object({ title: z.string().min(1) }))
    .output(Post)
    .errors({ UNAUTHORIZED: {} })
    .mutation(),
  onAdd: c.output(Post).subscription({ tracked: true }),
};

export const appContract = {
  health: c.output(z.literal('ok')).query(),
  post: postContract,
};
export type AppContract = typeof appContract;
