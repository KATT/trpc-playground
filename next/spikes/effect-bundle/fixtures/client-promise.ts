import { createClient, httpTerminal } from '../sketch/promise.ts';

export const client = createClient({ terminal: httpTerminal('/trpc') });
