import { deserializers, serializers } from '../../danson/std.ts';
import { parseSync, stringifySync } from '../../danson/sync.ts';

export const stringify = (value: unknown) =>
  stringifySync(value, { serializers });
export const parse = (text: string) => parseSync(text, { deserializers });
