/**
 * The default wire serializer: a port of [danSON](https://github.com/KATT/danson).
 *
 * Plain JSON stays plain JSON. Non-JSON values (`Date`, `Map`, `Set`,
 * `BigInt`, `undefined`, typed arrays, …) become inline
 * `{ _: '$', type, value }` markers, and repeated or circular references become
 * `$n` refs. Deferred values (`Promise`, `AsyncIterable`, `ReadableStream`) can
 * be streamed as chunks after the head.
 *
 * The serializer is configured on the endpoint: pass the same one to
 * `createFetchHandler({ serializer })` and `httpLink({ serializer })`.
 *
 * @module
 */
import type { Effect, Stream } from 'effect';
import { fromSearch, toSearch } from './query.ts';
import {
  deserializers as stdDeserializers,
  inputDeserializers as stdInputDeserializers,
  serializers as stdSerializers,
} from './std.ts';
import {
  deserializeStream,
  serializeDeferred,
  type Frame,
  type SerializedDeferred,
} from './stream.ts';
import {
  deserializeSync,
  serializeSync,
  type DeserializeRecord,
  type SerializeRecord,
  type SerializeReturn,
} from './sync.ts';
import type { DansonError } from './utils.ts';

export type { Chunk, Frame, SerializedDeferred } from './stream.ts';
export type {
  DeserializeRecord,
  SerializeRecord,
  SerializeReturn,
} from './sync.ts';
export { DansonError } from './utils.ts';
export type { JsonValue } from './utils.ts';

/**
 * A custom type the serializer understands.
 *
 * @example
 * ```ts
 * const decimal: CustomType<Decimal, string> = {
 *   is: (v) => v instanceof Decimal,
 *   serialize: (v) => v.toString(),
 *   deserialize: (s) => new Decimal(s),
 * };
 * createSerializer({ types: { Decimal: decimal } });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface CustomType<T, TSerialized = unknown> {
  /** Whether `value` is of this type. */
  is: (value: unknown) => value is T;
  /** Converts the value into something the serializer understands. */
  serialize: (value: T) => TSerialized;
  /** Rebuilds the value. */
  deserialize: (value: TSerialized) => T;
  /**
   * Accept this type in procedure inputs.
   * @default true
   */
  input?: boolean;
}

/**
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface SerializerOptions {
  /** Custom types, keyed by the name used on the wire. */
  types?: Record<string, CustomType<any, any>>;
  /**
   * Max nesting depth accepted when deserializing.
   * @default 64
   */
  maxDepth?: number;
}

/**
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface DeserializeOpts {
  /**
   * Deserializing untrusted input. Types that are unsafe to accept from a
   * client (`RegExp`, ReDoS) are rejected.
   */
  input?: boolean;
}

/**
 * Converts values to and from the wire format. Both ends of an endpoint must
 * use compatible serializers.
 *
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface Serializer {
  /** Serializes a value with no deferred parts. Throws on a `Promise` or stream. */
  serialize(value: unknown): SerializeReturn;
  deserialize<T = unknown>(value: SerializeReturn, opts?: DeserializeOpts): T;
  /** Serializes a value that may hold deferred parts. */
  serializeDeferred(
    value: unknown,
    opts?: { coerceError?: (cause: unknown) => unknown },
  ): SerializedDeferred;
  /** Rebuilds a value from its head frame and chunks. */
  deserializeStream<T, E>(
    frames: Stream.Stream<Frame, E>,
    opts?: { reviveError?: (value: unknown) => unknown },
  ): Effect.Effect<T, E | DansonError>;
  /** Encodes a value as legible URL query params (`a=1&tags[]=x`). */
  toSearch(value: unknown): string;
  fromSearch<T = unknown>(search: string, opts?: DeserializeOpts): T;
}

/**
 * Creates a danSON-based serializer, optionally with extra types.
 *
 * @example
 * ```ts
 * const serializer = createSerializer({ types: { Decimal: decimal } });
 * createFetchHandler({ router, serializer });
 * httpLink({ url, serializer });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function createSerializer(opts: SerializerOptions = {}): Serializer {
  const customSerializers: SerializeRecord = {};
  const customDeserializers: DeserializeRecord = {};
  const customInputDeserializers: DeserializeRecord = {};
  for (const [name, type] of Object.entries(opts.types ?? {})) {
    customSerializers[name] = (v) => (type.is(v) ? type.serialize(v) : false);
    customDeserializers[name] = (v) => type.deserialize(v);
    if (type.input !== false) {
      customInputDeserializers[name] = customDeserializers[name];
    }
  }
  const serializers = { ...customSerializers, ...stdSerializers };
  const output = {
    deserializers: { ...stdDeserializers, ...customDeserializers },
    maxDepth: opts.maxDepth,
  };
  const input = {
    deserializers: { ...stdInputDeserializers, ...customInputDeserializers },
    maxDepth: opts.maxDepth,
  };
  const de = (o?: DeserializeOpts) => (o?.input ? input : output);

  return {
    serialize: (value) => serializeSync(value, { serializers }),
    deserialize: (value, o) => deserializeSync(value, de(o)),
    serializeDeferred: (value, o) =>
      serializeDeferred(value, { serializers, coerceError: o?.coerceError }),
    deserializeStream: (frames, o) =>
      deserializeStream(frames, { ...output, reviveError: o?.reviveError }),
    toSearch: (value) => toSearch(value, { serializers }),
    fromSearch: (search, o) => fromSearch(search, de(o)),
  };
}

/**
 * The serializer used when none is configured.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export const defaultSerializer: Serializer = createSerializer();
