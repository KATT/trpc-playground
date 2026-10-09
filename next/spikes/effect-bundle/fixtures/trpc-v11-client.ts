// v11 baseline: the smallest typical client.
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AnyTRPCRouter } from '@trpc/server';

export const client = createTRPCClient<AnyTRPCRouter>({
  links: [httpBatchLink({ url: '/trpc' })],
});
