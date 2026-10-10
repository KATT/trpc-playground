/// <reference types="node" />
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE = {
  continuation: 0x0,
  text: 0x1,
  binary: 0x2,
  close: 0x8,
  ping: 0x9,
  pong: 0xa,
} as const;

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/**
 * Options for {@link acceptWebSocket}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface AcceptWebSocketOptions {
  /**
   * Max size of one message, in bytes. Larger messages close the socket
   * with 1009.
   * @default 1_048_576
   */
  maxPayload?: number;
}

/**
 * A server-side WebSocket over a Node socket: a small RFC 6455
 * implementation (text and binary messages, fragmentation, ping/pong, the
 * close handshake) with the standard `WebSocket` interface. No
 * compression or subprotocols.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export class NodeWebSocket extends EventTarget {
  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSING = CLOSING;
  static readonly CLOSED = CLOSED;

  #socket: Duplex;
  #readyState: number = OPEN;
  #buffer: Buffer = Buffer.alloc(0);
  #fragments: Buffer[] = [];
  #fragmentOpcode = 0;
  #fragmentSize = 0;
  #maxPayload: number;
  #closeSent = false;
  #closeCode = 1006;
  #closeReason = '';
  #decoder = new TextDecoder('utf-8', { fatal: true });

  constructor(socket: Duplex, head: Buffer, opts: AcceptWebSocketOptions = {}) {
    super();
    this.#socket = socket;
    this.#maxPayload = opts.maxPayload ?? 1_048_576;
    socket.on('data', (data: Buffer) => this.#receive(data));
    socket.on('close', () => this.#finish());
    // `node:http` sockets allow half-open connections; finish ours too.
    socket.on('end', () => socket.end());
    socket.on('error', () => socket.destroy());
    if (head.length > 0) queueMicrotask(() => this.#receive(head));
  }

  get readyState(): number {
    return this.#readyState;
  }

  /** Sends a text (`string`) or binary message. */
  send(data: string | ArrayBufferView | ArrayBuffer): void {
    if (this.#readyState !== OPEN) return;
    if (typeof data === 'string') {
      this.#frame(OPCODE.text, Buffer.from(data, 'utf8'));
    } else {
      const bytes = ArrayBuffer.isView(data)
        ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        : Buffer.from(data);
      this.#frame(OPCODE.binary, bytes);
    }
  }

  /** Starts the close handshake. */
  close(code = 1000, reason = ''): void {
    if (this.#readyState >= CLOSING) return;
    this.#readyState = CLOSING;
    this.#sendClose(code, reason);
    setTimeout(() => this.#socket.destroy(), 1000).unref();
  }

  #frame(opcode: number, payload: Buffer) {
    const length = payload.length;
    let header: Buffer;
    if (length < 126) {
      header = Buffer.from([0x80 | opcode, length]);
    } else if (length < 65_536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    this.#socket.write(Buffer.concat([header, payload]));
  }

  #sendClose(code: number, reason: string) {
    if (this.#closeSent) return;
    this.#closeSent = true;
    const reasonBytes = Buffer.from(reason, 'utf8').subarray(0, 123);
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    this.#frame(OPCODE.close, payload);
  }

  #fail(code: number, reason: string) {
    this.#closeCode = code;
    this.#closeReason = reason;
    this.close(code, reason);
    this.#buffer = Buffer.alloc(0);
  }

  #receive(data: Buffer) {
    if (this.#readyState === CLOSED) return;
    this.#buffer =
      this.#buffer.length === 0 ? data : Buffer.concat([this.#buffer, data]);
    while (this.#readyState !== CLOSED) {
      const buffer = this.#buffer;
      if (buffer.length < 2) return;
      const first = buffer[0]!;
      const second = buffer[1]!;
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;
      if (first & 0x70) return this.#fail(1002, 'Reserved bits are set');
      if (!masked) return this.#fail(1002, 'Client frames must be masked');
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        const big = buffer.readBigUInt64BE(2);
        if (big > BigInt(this.#maxPayload)) {
          return this.#fail(1009, 'Message too big');
        }
        length = Number(big);
        offset = 10;
      }
      if (length > this.#maxPayload) return this.#fail(1009, 'Message too big');
      if (buffer.length < offset + 4 + length) return;
      const mask = buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(
        buffer.subarray(offset + 4, offset + 4 + length),
      );
      for (let i = 0; i < payload.length; i++) payload[i]! ^= mask[i % 4]!;
      this.#buffer = buffer.subarray(offset + 4 + length);
      this.#handleFrame(fin, opcode, payload);
    }
  }

  #handleFrame(fin: boolean, opcode: number, payload: Buffer) {
    if (opcode >= 0x8) {
      if (!fin || payload.length > 125) {
        return this.#fail(1002, 'Invalid control frame');
      }
      if (opcode === OPCODE.close) {
        if (payload.length >= 2) {
          this.#closeCode = payload.readUInt16BE(0);
          this.#closeReason = payload.subarray(2).toString('utf8');
        } else {
          this.#closeCode = 1005;
        }
        this.#readyState = CLOSING;
        this.#sendClose(this.#closeCode === 1005 ? 1000 : this.#closeCode, '');
        this.#socket.end();
        return;
      }
      if (opcode === OPCODE.ping) this.#frame(OPCODE.pong, payload);
      return;
    }
    if (opcode === OPCODE.continuation) {
      if (this.#fragments.length === 0) {
        return this.#fail(1002, 'Unexpected continuation frame');
      }
    } else if (opcode === OPCODE.text || opcode === OPCODE.binary) {
      if (this.#fragments.length > 0) {
        return this.#fail(1002, 'Expected a continuation frame');
      }
      this.#fragmentOpcode = opcode;
      this.#fragmentSize = 0;
    } else {
      return this.#fail(1002, 'Unknown opcode');
    }
    this.#fragmentSize += payload.length;
    if (this.#fragmentSize > this.#maxPayload) {
      return this.#fail(1009, 'Message too big');
    }
    this.#fragments.push(payload);
    if (!fin) return;
    const message = Buffer.concat(this.#fragments);
    this.#fragments = [];
    if (this.#readyState !== OPEN) return;
    let data: string | ArrayBuffer;
    if (this.#fragmentOpcode === OPCODE.text) {
      try {
        data = this.#decoder.decode(message);
      } catch {
        return this.#fail(1007, 'Invalid UTF-8');
      }
    } else {
      data = message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength,
      ) as ArrayBuffer;
    }
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  #finish() {
    if (this.#readyState === CLOSED) return;
    this.#readyState = CLOSED;
    this.dispatchEvent(
      new CloseEvent('close', {
        code: this.#closeCode,
        reason: this.#closeReason,
        wasClean: this.#closeSent && this.#closeCode !== 1006,
      }),
    );
  }
}

const reject = (socket: Duplex, status: number, message: string) => {
  socket.end(
    `HTTP/1.1 ${status} ${message}\r\nconnection: close\r\ncontent-length: 0\r\n\r\n`,
  );
};

/**
 * Completes a WebSocket upgrade (RFC 6455) on a Node `upgrade` event.
 * Returns `undefined`, after answering with an HTTP error, when the request
 * is not a valid upgrade.
 *
 * @example
 * ```ts
 * server.on('upgrade', (req, socket, head) => {
 *   const ws = acceptWebSocket(req, socket, head);
 *   if (ws) ws.addEventListener('message', (e) => ws.send(e.data));
 * });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function acceptWebSocket(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  opts: AcceptWebSocketOptions = {},
): NodeWebSocket | undefined {
  const key = req.headers['sec-websocket-key'];
  if (
    req.method !== 'GET' ||
    req.headers.upgrade?.toLowerCase() !== 'websocket' ||
    typeof key !== 'string' ||
    Buffer.from(key, 'base64').length !== 16
  ) {
    reject(socket, 400, 'Bad Request');
    return undefined;
  }
  if (req.headers['sec-websocket-version'] !== '13') {
    socket.end(
      'HTTP/1.1 426 Upgrade Required\r\nsec-websocket-version: 13\r\nconnection: close\r\ncontent-length: 0\r\n\r\n',
    );
    return undefined;
  }
  const accept = createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: ${accept}\r\n\r\n`,
  );
  (socket as { setNoDelay?: (v: boolean) => void }).setNoDelay?.(true);
  return new NodeWebSocket(socket, head, opts);
}

/** @internal */
export { reject as rejectUpgrade };
