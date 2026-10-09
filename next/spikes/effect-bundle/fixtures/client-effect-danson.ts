import { deserializers, serializers } from '../../danson/std.ts';
import { parseSync, stringifySync } from '../../danson/sync.ts';
import { createPromiseClient, httpTerminal } from '../sketch/effect.ts';

export const client = createPromiseClient({
  terminal: httpTerminal('/trpc', {
    stringify: (value) => stringifySync(value, { serializers }),
    parse: (text) => parseSync(text, { deserializers }),
  }),
});
