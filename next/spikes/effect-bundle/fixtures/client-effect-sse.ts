import {
  asIterable,
  createPromiseClient,
  httpTerminal,
  sseTerminal,
} from '../sketch/effect.ts';

export const client = createPromiseClient({
  terminal: httpTerminal('/trpc'),
  subscribe: asIterable(sseTerminal('/trpc')),
});
