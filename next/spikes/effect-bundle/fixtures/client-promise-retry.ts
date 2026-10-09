import { createClient, httpTerminal, retryLink } from '../sketch/promise.ts';

export const client = createClient({
  links: [retryLink(2)],
  terminal: httpTerminal('/trpc'),
});
