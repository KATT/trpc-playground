import * as original from 'danson';
import { describe, expect, test } from 'vite-plus/test';
import { deserializers, inputDeserializers, serializers } from './std.ts';
import { parseAsync, stringifyAsync } from './stream.ts';
import { parseSync, stringifySync } from './sync.ts';

const ser = { serializers };
const de = { deserializers };

const corpus: Record<string, unknown> = {
  primitives: { a: 1, b: 'x', c: true, d: null, e: [1, 'two'] },
  std: {
    date: new Date('2026-10-09T00:00:00.000Z'),
    big: 123n,
    map: new Map<unknown, unknown>([['k', { v: 1 }]]),
    set: new Set([1, 2]),
    url: new URL('https://trpc.io/?a=1'),
    params: new URLSearchParams('a=1&b=2'),
    regexp: /a+b/gi,
    bytes: new Uint8Array([1, 2, 3]),
    special: [undefined, NaN, Infinity, -Infinity, -0],
  },
  dollarStrings: { a: '$undefined', b: '$1', c: '$', d: '$$x' },
  nestedStd: [
    { when: [new Date(0)] },
    new Map([[new Date(1), new Set(['x'])]]),
  ],
};

const circular = (() => {
  const a: Record<string, unknown> = { name: 'a' };
  a['self'] = a;
  return { a, list: [a] };
})();

async function collect(iterable: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const line of iterable) out.push(line);
  return out;
}
async function* fromArray(lines: string[]) {
  yield* lines;
}

describe('sync: wire compatible with danson@0.13.1', () => {
  test.each(Object.entries(corpus))('%s: identical output', (_, value) => {
    expect(stringifySync(value, ser)).toBe(original.stringifySync(value, ser));
  });

  test.each(Object.entries(corpus))('%s: round-trips both ways', (_, value) => {
    expect(parseSync(original.stringifySync(value, ser), de)).toEqual(value);
    expect(original.parseSync(stringifySync(value, ser), de)).toEqual(value);
  });

  test('circular references', () => {
    const text = stringifySync(circular, ser);
    expect(text).toBe(original.stringifySync(circular, ser));
    const back = parseSync<typeof circular>(text, de);
    expect(back.a['self']).toBe(back.a);
    // Only cycles become refs; other repeats are copied unless `dedupe` is set.
    expect(back.list[0]).not.toBe(back.a);
    expect(back.list[0]).toEqual(back.a);
  });
});

describe('async: Effect Stream port, wire compatible', () => {
  const make = ({ readableStream = true } = {}) => ({
    head: 'now',
    later: Promise.resolve({ at: new Date(5), deeper: Promise.resolve(42n) }),
    failing: Promise.reject(new Error('nope')),
    items: (async function* () {
      yield 1;
      yield Promise.resolve('nested');
      return 'done';
    })(),
    bytes: readableStream
      ? new ReadableStream<string>({
          start(c) {
            c.enqueue('a');
            c.enqueue('b');
            c.close();
          },
        })
      : (async function* () {
          yield 'a';
          yield 'b';
        })(),
  });
  const coerceError = (cause: unknown) =>
    cause instanceof Error ? { message: cause.message } : cause;

  type Shape = {
    head: string;
    later: Promise<{ at: Date; deeper: Promise<bigint> }>;
    failing: Promise<never>;
    items: AsyncIterable<number | Promise<string>>;
    bytes: ReadableStream<string> | AsyncIterable<string>;
  };

  async function check(value: Shape) {
    expect(value.head).toBe('now');
    const later = await value.later;
    expect(later.at).toEqual(new Date(5));
    expect(await later.deeper).toBe(42n);
    await expect(value.failing).rejects.toEqual({ message: 'nope' });
    const items: unknown[] = [];
    for await (const it of value.items) items.push(it);
    expect(items).toEqual([1, 'nested']);
    const chunks: string[] = [];
    for await (const c of value.bytes as unknown as AsyncIterable<string>) {
      chunks.push(c);
    }
    expect(chunks).toEqual(['a', 'b']);
  }

  test('port → port', async () => {
    const lines = await collect(
      stringifyAsync(make(), { ...ser, coerceError }),
    );
    await check(await parseAsync<Shape>(fromArray(lines), de));
  });

  test('port → danson', async () => {
    const lines = await collect(
      stringifyAsync(make(), { ...ser, coerceError }),
    );
    await check(await original.parseAsync<Shape>(fromArray(lines), de));
  });

  test('danson → port', async () => {
    // danson@0.13.1 throws serializing a ReadableStream (`reader.cancel()` after `releaseLock()`).
    const lines = await collect(
      original.stringifyAsync(make({ readableStream: false }), {
        ...ser,
        coerceError,
      }),
    );
    await check(await parseAsync<Shape>(fromArray(lines), de));
  });

  test('head arrives before deferred values resolve', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const source = stringifyAsync({ now: 1, later: gate.then(() => 2) }, ser);
    const iterator = source[Symbol.asyncIterator]();
    const head = await iterator.next();
    expect(head.value).toBe(
      '{"json":{"now":1,"later":{"_":"$","type":"Promise","value":1}}}\n',
    );
    release();
    const rest: string[] = [];
    for (let r = await iterator.next(); !r.done; r = await iterator.next()) {
      rest.push(r.value);
    }
    expect(rest).toEqual(['[1,0,{"json":2}]\n']);
  });

  test('a truncated stream rejects pending values', async () => {
    const lines = await collect(
      stringifyAsync({ later: Promise.resolve(1) }, ser),
    );
    const value = await parseAsync<{ later: Promise<number> }>(
      fromArray(lines.slice(0, 1)),
      de,
    );
    await expect(value.later).rejects.toThrow('Stream interrupted');
  });
});

describe('hardening (proposal 11 (e))', () => {
  test('rejects prototype keys', () => {
    expect(() => parseSync('{"json":{"__proto__":{"x":1}}}', de)).toThrow(
      'Forbidden key: __proto__',
    );
  });

  test('depth limit', () => {
    const deep = JSON.stringify({
      json: JSON.parse('['.repeat(100) + ']'.repeat(100)),
    });
    expect(() => parseSync(deep, { ...de, maxDepth: 64 })).toThrow('Max depth');
  });

  test('RegExp is not accepted by the input allow-list', () => {
    const text = stringifySync({ r: /x/ }, ser);
    expect(() =>
      parseSync(text, { deserializers: inputDeserializers }),
    ).toThrow('No deserializer for type: RegExp');
  });

  test('TypedArray only constructs typed arrays', () => {
    const text =
      '{"json":{"_":"$","type":"TypedArray","value":["Error",["boom"]]}}';
    expect(() => parseSync(text, de)).toThrow('Unknown typed array: Error');
    // danson@0.13.1 looks the name up on globalThis and constructs it:
    expect(
      original.parseSync(text, { deserializers: original.std.deserializers }),
    ).toBeInstanceOf(Error);
  });
});
