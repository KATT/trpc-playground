// `client-effect-full` without danSON streaming responses, to isolate its cost.
import { deserializers, serializers } from '../../danson/std.ts';
import { parseSync, stringifySync } from '../../danson/sync.ts';
import {
  asIterable,
  createPromiseClient,
  httpTerminal,
  retryLink,
  sseTerminal,
} from '../sketch/effect.ts';

const codec = {
  stringify: (value: unknown) => stringifySync(value, { serializers }),
  parse: (text: string) => parseSync(text, { deserializers }),
};

export const client = createPromiseClient({
  links: [retryLink(2, 5_000)],
  terminal: httpTerminal('/trpc', codec),
  subscribe: asIterable(sseTerminal('/trpc', codec)),
});
