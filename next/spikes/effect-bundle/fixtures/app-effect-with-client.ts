// `app-effect` plus the full Effect-surface client sketch: the marginal cost of
// tRPC for an app that already ships Effect.
import { deserializers, serializers } from '../../danson/std.ts';
import { parseStream } from '../../danson/stream.ts';
import { parseSync, stringifySync } from '../../danson/sync.ts';
import {
  createEffectClient,
  httpTerminal,
  retryLink,
  sseTerminal,
} from '../sketch/effect.ts';

export * from './app-effect.ts';

const codec = {
  stringify: (value: unknown) => stringifySync(value, { serializers }),
  parse: (text: string) => parseSync(text, { deserializers }),
};

export const client = createEffectClient({
  links: [retryLink(2, 5_000)],
  terminal: httpTerminal('/trpc', codec),
  subscribe: sseTerminal('/trpc', codec),
});
export { parseStream };
