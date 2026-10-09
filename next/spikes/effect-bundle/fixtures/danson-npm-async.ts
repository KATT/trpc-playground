import { parseAsync, std, stringifyAsync } from 'danson';

export const stringify = (value: unknown) =>
  stringifyAsync(value, { serializers: std.serializers });
export const parse = (lines: AsyncIterable<string>) =>
  parseAsync(lines, { deserializers: std.deserializers });
