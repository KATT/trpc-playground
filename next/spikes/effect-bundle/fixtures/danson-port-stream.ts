import { deserializers, serializers } from '../../danson/std.ts';
import { parseAsync, stringifyAsync } from '../../danson/stream.ts';

export const stringify = (value: unknown) =>
  stringifyAsync(value, { serializers });
export const parse = (lines: AsyncIterable<string>) =>
  parseAsync(lines, { deserializers });
