import { parseSync, std, stringifySync } from 'danson';

export const stringify = (value: unknown) =>
  stringifySync(value, { serializers: std.serializers });
export const parse = (text: string) =>
  parseSync(text, { deserializers: std.deserializers });
