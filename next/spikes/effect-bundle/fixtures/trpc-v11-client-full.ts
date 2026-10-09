// v11 baseline: batching + streaming + SSE subscriptions + retry + superjson.
import {
  createTRPCClient,
  httpBatchStreamLink,
  httpSubscriptionLink,
  retryLink,
  splitLink,
} from '@trpc/client';
import type { AnyTRPCRouter } from '@trpc/server';
import superjson from 'superjson';

export const client = createTRPCClient<AnyTRPCRouter>({
  links: [
    retryLink({ retry: (opts) => opts.attempts < 3 }),
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({ url: '/trpc', transformer: superjson }),
      false: httpBatchStreamLink({ url: '/trpc', transformer: superjson }),
    }),
  ],
});
