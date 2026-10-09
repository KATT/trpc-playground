// Promise surface, Effect internals (what Promise users would ship).
import { createPromiseClient, httpTerminal } from '../sketch/effect.ts';

export const client = createPromiseClient({ terminal: httpTerminal('/trpc') });
