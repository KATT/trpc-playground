# 19 — TanStack Query integration

| Status     | Area         | Depends on     | oRPC parity rows                                                          |
| ---------- | ------------ | -------------- | ------------------------------------------------------------------------- |
| `proposed` | integrations | 07, 11, 14, 16 | **TanStack Query (React, Vue, Solid, Svelte, Angular)**, Vue Pinia Colada |

## Summary

`ideas.md`: "`@trpc/react-query` is dead; `@trpc/tanstack-query` stays."

**Recommendation:**

- Make `@trpcdev/tanstack-query` **framework-agnostic**. It produces plain options objects (`queryOptions`, `mutationOptions`, `infiniteOptions`, keys and filters) that work with every TanStack adapter.
- Optional React context helpers live in a `./react` subpath.
- Option bags, explicit infinite-query inputs, streamed/live query helpers, and a hydration serializer.

## Today (v11)

- `@trpc/tanstack-react-query`:
  - `createTRPCContext<AppRouter>()` gives `{ TRPCProvider, useTRPC, useTRPCClient }`. Alternatively, `createTRPCOptionsProxy({ client, queryClient })` for singletons, or `({ router, ctx, queryClient })` on the server.
  - `trpc.post.byId.queryOptions(input, opts)`, `.mutationOptions()`, `.infiniteQueryOptions(input, { getNextPageParam })` (the cursor is injected into `input.cursor`), `.queryKey()`, `.queryFilter()`, `.pathKey()`, `.subscriptionOptions()` + `useSubscription`.
- React-only in name and in a few helpers. oRPC marks Vue, Solid, Svelte and Angular as 🛑 for tRPC.

## Goals

- One package for every TanStack framework.
- Option bags (`ideas.md`).
- Typed errors (07) in `error`.
- SSR and hydration with rich types (Dates and so on) working out of the box.

## Proposed API

```ts
import { createTRPCQueryUtils } from '@trpcdev/tanstack-query';

export const trpc = createTRPCQueryUtils({ client }); // the client from 16

// React, Vue, Solid, Svelte, Angular: same objects
useQuery(trpc.post.byId.queryOptions({ input: { id }, staleTime: 1000 }));
useMutation(
  trpc.post.create.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.post.pathFilter()),
  }),
);
useInfiniteQuery(
  trpc.post.list.infiniteOptions({
    input: (cursor: string | undefined) => ({ limit: 20, cursor }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor,
  }),
);
useQuery(trpc.chat.stream.streamedOptions({ input: { chatId } })); // accumulates streamed chunks
useQuery(trpc.price.live.liveOptions({ input: { symbol } })); // latest value of a subscription

trpc.post.byId.queryKey({ input: { id } });
trpc.post.pathKey();
trpc.post.byId.queryOptions({ input: skipToken });
```

- **React helpers** (`@trpcdev/tanstack-query/react`): `createTRPCContext()` → `{ TRPCProvider, useTRPC }`, for people who want React context instead of module singletons.
- **Server prefetching:** `createTRPCQueryUtils({ client: createRouterClient(appRouter, { ctx }) })`. The utils accept any client shape that implements the untyped client interface.
- **Hydration:** `hydrationSerializer` from the core serializer, for `QueryClient({ defaultOptions: { dehydrate: { serializeData }, hydrate: { deserializeData } } })`.
- **Keys:** keep v11's `[path, { input, type }]` key format where possible, so existing knowledge transfers.

## Recommendation

- One framework-agnostic package with a `./react` subpath.
- Option-bag API.
- Explicit infinite `input: (pageParam) => …`.
- `streamedOptions` and `liveOptions` in v1.
- Hydration serializer.
- Pinia Colada later.

> ⚠️ **Parity:** a React-only integration (hooks or providers in the core path) would keep Vue, Solid, Svelte and Angular at 🛑.

## Questions for Alex

- **Q19.1** One framework-agnostic package + `./react` (recommended), or per-framework packages?
- **Q19.2** `queryOptions({ input, ...opts })` option bag (recommended), or v11's positional `queryOptions(input, opts)`?
- **Q19.3** Infinite queries: explicit `input: (pageParam) => …` (recommended), or v11's `cursor` convention?
- **Q19.4** Factory name: `createTRPCQueryUtils`, `createTRPCOptionsProxy` (v11) or something else?
- **Q19.5** `streamedOptions`/`liveOptions` in v1?
- **Q19.6** Pinia Colada: later, or never?

## Decision

- **Q19.1:** [ ] agnostic + `./react` · [ ] per framework
- **Q19.2:** [ ] option bag · [ ] positional
- **Q19.3:** [ ] explicit input fn · [ ] cursor convention
- **Q19.4:** name: `__________`
- **Q19.5:** [ ] yes · [ ] later
- **Q19.6:** [ ] later · [ ] never
- **Notes:**
