/** The wire protocol version this build speaks. */
export const PROTOCOL_VERSION = '1';

export const HEADER = {
  version: 'trpc-version',
  batch: 'trpc-batch',
  lastEventId: 'last-event-id',
} as const;

export const CONTENT_TYPE = {
  json: 'application/json',
  jsonl: 'application/jsonl',
  sse: 'text/event-stream',
} as const;

/** One call in a batch request body. */
export interface BatchCall {
  path: string;
  input?: unknown;
}

/** One JSONL line of a batch response. */
export type BatchLine =
  | { i: number; status: number; body: unknown }
  | { i: number; chunk: unknown };

export const isJsonContentType = (value: string | null): boolean =>
  value !== null && /^application\/json\b/i.test(value);

const textDecoder = () =>
  new TextDecoderStream() as unknown as ReadableWritablePair<
    string,
    Uint8Array
  >;

/** Parses SSE events out of a text stream, per the HTML spec's rules. */
export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string; id: string | undefined }> {
  const reader = stream.pipeThrough(textDecoder()).getReader();
  let buffer = '';
  let data: string[] = [];
  let event = '';
  let id: string | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += value;
      let newline: number;
      while ((newline = buffer.search(/\r\n|\r|\n/)) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(
          newline + (buffer.startsWith('\r\n', newline) ? 2 : 1),
        );
        if (line === '') {
          if (data.length > 0 || event) {
            yield { event: event || 'message', data: data.join('\n'), id };
          }
          data = [];
          event = '';
          id = undefined;
          continue;
        }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let val = colon === -1 ? '' : line.slice(colon + 1);
        if (val.startsWith(' ')) val = val.slice(1);
        if (field === 'data') data.push(val);
        else if (field === 'event') event = val;
        else if (field === 'id') id = val;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Splits a byte stream into non-empty lines. */
export async function* readLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.pipeThrough(textDecoder()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield line;
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } finally {
    await reader.cancel().catch(() => {});
  }
}
