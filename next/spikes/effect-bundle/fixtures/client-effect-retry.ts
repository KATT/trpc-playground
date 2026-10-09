import {
  createPromiseClient,
  httpTerminal,
  retryLink,
} from '../sketch/effect.ts';

export const client = createPromiseClient({
  links: [retryLink(2, 5_000)],
  terminal: httpTerminal('/trpc'),
});
