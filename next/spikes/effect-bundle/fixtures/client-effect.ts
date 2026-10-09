// Effect surface: procedures return `Effect`; the app runs them.
import * as Effect from 'effect/Effect';
import { createEffectClient, httpTerminal } from '../sketch/effect.ts';

export const client = createEffectClient({ terminal: httpTerminal('/trpc') });
export const run = Effect.runPromise;
