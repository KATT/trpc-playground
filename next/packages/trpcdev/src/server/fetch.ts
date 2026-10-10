import {
  Context,
  Effect,
  Exit,
  ManagedRuntime,
  Stream,
  type Layer,
} from 'effect';
import {
  isTRPCError,
  toWireError,
  TRPCError,
  type AnyTRPCError,
} from '../internal/error.ts';
import {
  CONTENT_TYPE,
  HEADER,
  isJsonContentType,
  PROTOCOL_VERSION,
  type BatchCall,
  type BatchLine,
} from '../internal/protocol.ts';
import type { MaybePromise, ProcedureType } from '../internal/types.ts';
import { defaultSerializer, type Serializer } from '../serializer/index.ts';
import type { Chunk } from '../serializer/stream.ts';
import {
  callProcedure,
  isUnexpectedError,
  normalizeCause,
  unexpectedError,
} from './execute.ts';
import type { AnyProcedure } from './procedure.ts';
import {
  getProcedure,
  type AnyRouter,
  type inferRouterContext,
  type inferRouterServices,
} from './router.ts';
import { isTracked } from './tracked.ts';

/**
 * What `createContext` receives.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface CreateContextOpts {
  readonly request: Request;
  readonly info: {
    /** Every call in the request: one, or several for a batch. */
    readonly calls: ReadonlyArray<{ path: string; type: ProcedureType }>;
    readonly signal: AbortSignal;
  };
}

/**
 * What `onError` receives. `error.cause` holds the original thrown value.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface OnErrorOpts {
  readonly error: AnyTRPCError;
  readonly path: string | undefined;
  readonly type: ProcedureType | undefined;
  readonly request: Request;
}

type ContextOption<TCtx> = {} extends TCtx
  ? {
      /** Runs once per request (once per batch). */
      createContext?: (opts: CreateContextOpts) => MaybePromise<TCtx>;
    }
  : {
      /** Runs once per request (once per batch). */
      createContext: (opts: CreateContextOpts) => MaybePromise<TCtx>;
    };

type LayerOption<TServices> = [TServices] extends [never]
  ? { layer?: Layer.Layer<any, any, never> }
  : {
      /** Provides the Effect services the router's procedures need (02 S1). */
      layer: Layer.Layer<TServices, any, never>;
    };

/**
 * Options shared by every handler.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface BaseHandlerOptions<TRouter extends AnyRouter> {
  router: TRouter;
  /**
   * The path prefix procedures are served under.
   * @default '/trpc'
   */
  endpoint?: string;
  /** Must match the client's. @default defaultSerializer */
  serializer?: Serializer;
  /**
   * Accept batched requests (opt-in, 10).
   * @default false
   */
  batch?: boolean | { maxItems?: number };
  /**
   * Max request body size, in bytes.
   * @default 1_048_576
   */
  maxBodySize?: number;
  /**
   * Send the real message of unexpected errors to the client (0003).
   * @default true only when `NODE_ENV` is `development` or `test`
   */
  exposeUnexpectedErrors?: boolean;
  /** Called for every error, with the original cause. */
  onError?: (opts: OnErrorOpts) => void;
}

/**
 * The options of {@link createFetchHandler}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type FetchHandlerOptions<TRouter extends AnyRouter> =
  BaseHandlerOptions<TRouter> &
    ContextOption<inferRouterContext<TRouter>> &
    LayerOption<inferRouterServices<TRouter>>;

/**
 * A web-standard request handler.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface FetchHandler {
  fetch(request: Request): Promise<Response>;
  /** Releases the `layer`'s resources. */
  dispose(): Promise<void>;
}

const encoder = new TextEncoder();
const isDev = () => {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.['NODE_ENV'];
  return env === 'development' || env === 'test';
};

const protocolError = (code: string, message: string) =>
  new TRPCError({ code, message });

interface CallResult {
  status: number;
  body: unknown;
  chunks?: Stream.Stream<Chunk, unknown> | undefined;
}

/**
 * Serves a router over the web-standard `fetch` interface (12 P-A). Works on
 * any runtime with `Request`/`Response`; `trpcdev/node` adapts it to
 * `node:http`.
 *
 * @example
 * ```ts
 * const handler = createFetchHandler({
 *   router: appRouter,
 *   createContext: ({ request }) => ({ user: getUser(request) }),
 *   layer: PostRepo.Live, // Effect services, when procedures need any
 * });
 * export default { fetch: handler.fetch };
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function createFetchHandler<TRouter extends AnyRouter>(
  opts: FetchHandlerOptions<TRouter>,
): FetchHandler {
  const { router } = opts;
  const createContext = (
    opts as { createContext?: (o: CreateContextOpts) => MaybePromise<object> }
  ).createContext;
  const layer = (opts as { layer?: Layer.Layer<any, any, never> }).layer;
  const serializer = opts.serializer ?? defaultSerializer;
  const endpoint = `/${(opts.endpoint ?? '/trpc').replace(/^\/+|\/+$/g, '')}`;
  const maxBodySize = opts.maxBodySize ?? 1_048_576;
  const expose = opts.exposeUnexpectedErrors ?? isDev();
  const batch =
    opts.batch === true
      ? { maxItems: 20 }
      : opts.batch
        ? { maxItems: opts.batch.maxItems ?? 20 }
        : undefined;

  const runtime = layer ? ManagedRuntime.make(layer) : undefined;
  let services: Promise<Context.Context<any>> | undefined;
  const getServices = () =>
    (services ??= runtime
      ? runtime.context()
      : Promise.resolve(Context.empty() as Context.Context<any>));

  const publicError = (err: AnyTRPCError) =>
    isUnexpectedError(err) && !expose
      ? new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        })
      : err;
  const wire = (err: AnyTRPCError) =>
    serializer.serialize(toWireError(publicError(err)));

  const respond = (
    status: number,
    body: BodyInit | null,
    contentType: string,
    extra?: Record<string, string>,
  ) =>
    new Response(body, {
      status,
      headers: {
        'content-type': contentType,
        [HEADER.version]: PROTOCOL_VERSION,
        ...extra,
      },
    });

  async function readBody(request: Request): Promise<unknown> {
    if (!isJsonContentType(request.headers.get('content-type'))) {
      throw protocolError(
        'UNSUPPORTED_MEDIA_TYPE',
        'POST requests must have content-type: application/json',
      );
    }
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > maxBodySize) {
      throw protocolError('PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
    const text = await request.text();
    if (encoder.encode(text).byteLength > maxBodySize) {
      throw protocolError('PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
    if (text === '') return undefined;
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new TRPCError({
        code: 'PARSE_ERROR',
        message: 'Invalid JSON',
        cause,
      });
    }
  }

  const deserializeInput = (value: unknown) => {
    if (value === undefined) return undefined;
    try {
      return serializer.deserialize(value as never, { input: true });
    } catch (cause) {
      throw new TRPCError({
        code: 'PARSE_ERROR',
        message: cause instanceof Error ? cause.message : 'Invalid input',
        cause,
      });
    }
  };

  async function readInput(request: Request, url: URL): Promise<unknown> {
    if (request.method === 'GET') {
      if (url.search.length <= 1) return undefined;
      try {
        return serializer.fromSearch(url.search, { input: true });
      } catch (cause) {
        throw new TRPCError({
          code: 'PARSE_ERROR',
          message: cause instanceof Error ? cause.message : 'Invalid input',
          cause,
        });
      }
    }
    return deserializeInput(await readBody(request));
  }

  async function makeContext(
    request: Request,
    calls: CreateContextOpts['info']['calls'],
  ): Promise<object> {
    if (!createContext) return {};
    return await createContext({
      request,
      info: { calls, signal: request.signal },
    });
  }

  function report(
    error: AnyTRPCError,
    request: Request,
    path?: string,
    type?: ProcedureType,
  ) {
    opts.onError?.({ error, path, type, request });
  }

  async function run(
    procedure: AnyProcedure,
    path: string,
    ctx: object,
    input: unknown,
    signal: AbortSignal,
    lastEventId?: string,
  ): Promise<Exit.Exit<unknown, AnyTRPCError>> {
    const context = await getServices();
    return Effect.runPromiseExitWith(context)(
      callProcedure({ procedure, path, ctx, input, signal, lastEventId }),
      { signal },
    );
  }

  /** Runs a query or mutation and serializes the outcome. */
  async function execute(
    request: Request,
    procedure: AnyProcedure,
    path: string,
    ctx: object,
    input: unknown,
    signal: AbortSignal,
  ): Promise<CallResult> {
    const type = procedure['~trpc'].type;
    const exit = await run(procedure, path, ctx, input, signal);
    if (Exit.isFailure(exit)) {
      const err = normalizeCause(exit.cause);
      report(err, request, path, type);
      return { status: err.status, body: wire(err) };
    }
    try {
      const { head, chunks } = serializer.serializeDeferred(exit.value, {
        coerceError: (cause) => {
          const err = isTRPCError(cause) ? cause : unexpectedError(cause);
          report(err, request, path, type);
          return toWireError(publicError(err));
        },
      });
      return { status: 200, body: head, chunks };
    } catch (cause) {
      const err = unexpectedError(cause);
      report(err, request, path, type);
      return { status: err.status, body: wire(err) };
    }
  }

  function linesResponse(
    produce: (write: (line: unknown) => void) => Promise<void>,
    signal: AbortSignal,
    abort: () => void,
    contentType: string = CONTENT_TYPE.jsonl,
  ): Response {
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let open = true;
        const write = (line: unknown) => {
          if (!open || signal.aborted) return;
          try {
            controller.enqueue(
              encoder.encode(
                typeof line === 'string' ? line : `${JSON.stringify(line)}\n`,
              ),
            );
          } catch {
            open = false;
          }
        };
        try {
          await produce(write);
        } finally {
          if (open && !signal.aborted) {
            open = false;
            controller.close();
          }
        }
      },
      cancel: abort,
    });
    return respond(200, body, contentType, {
      'cache-control': 'no-cache',
    });
  }

  const runChunks = (
    chunks: Stream.Stream<Chunk, unknown>,
    onChunk: (chunk: Chunk) => void,
    signal: AbortSignal,
  ) =>
    Effect.runPromiseExit(
      Stream.runForEach(chunks, (chunk) => Effect.sync(() => onChunk(chunk))),
      { signal },
    );

  async function single(
    request: Request,
    url: URL,
    path: string,
  ): Promise<Response> {
    const procedure = getProcedure(router, path);
    if (!procedure) {
      throw protocolError('NOT_FOUND', `No procedure at path "${path}"`);
    }
    const type = procedure['~trpc'].type;
    if (type === 'mutation' && request.method !== 'POST') {
      throw new TRPCError({
        code: 'METHOD_NOT_SUPPORTED',
        message: 'Mutations must use POST',
      });
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      throw protocolError(
        'METHOD_NOT_SUPPORTED',
        `${request.method} is not supported`,
      );
    }
    try {
      const input = await readInput(request, url);
      const ctx = await makeContext(request, [{ path, type }]);
      if (type === 'subscription') {
        return await subscription(request, procedure, path, ctx, input);
      }
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      request.signal.addEventListener('abort', onAbort, { once: true });
      const result = await execute(
        request,
        procedure,
        path,
        ctx,
        input,
        controller.signal,
      );
      if (!result.chunks) {
        return respond(
          result.status,
          JSON.stringify(result.body),
          CONTENT_TYPE.json,
        );
      }
      const chunks = result.chunks;
      return linesResponse(
        async (write) => {
          write(result.body);
          await runChunks(chunks, write, controller.signal);
        },
        controller.signal,
        onAbort,
      );
    } catch (cause) {
      const err = isTRPCError(cause) ? cause : unexpectedError(cause);
      report(err, request, path, type);
      return respond(err.status, JSON.stringify(wire(err)), CONTENT_TYPE.json);
    }
  }

  async function subscription(
    request: Request,
    procedure: AnyProcedure,
    path: string,
    ctx: object,
    input: unknown,
  ): Promise<Response> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener('abort', onAbort, { once: true });
    const lastEventId = request.headers.get(HEADER.lastEventId) ?? undefined;
    const exit = await run(
      procedure,
      path,
      ctx,
      input,
      controller.signal,
      lastEventId,
    );
    if (Exit.isFailure(exit)) {
      const err = normalizeCause(exit.cause);
      report(err, request, path, 'subscription');
      return respond(err.status, JSON.stringify(wire(err)), CONTENT_TYPE.json);
    }
    const events = exit.value as Stream.Stream<unknown, AnyTRPCError>;
    return linesResponse(
      async (write) => {
        const done = await Effect.runPromiseExit(
          Stream.runForEach(events, (event) =>
            Effect.sync(() => {
              const id = isTracked(event) ? `id: ${event.id}\n` : '';
              write(
                `${id}data: ${JSON.stringify(serializer.serialize(event))}\n\n`,
              );
            }),
          ),
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (Exit.isFailure(done)) {
          const err = normalizeCause(done.cause);
          report(err, request, path, 'subscription');
          write(`event: error\ndata: ${JSON.stringify(wire(err))}\n\n`);
          return;
        }
        write('event: done\ndata: \n\n');
      },
      controller.signal,
      onAbort,
      CONTENT_TYPE.sse,
    );
  }

  async function batched(request: Request): Promise<Response> {
    if (!batch) {
      throw protocolError('BAD_REQUEST', 'Batching is not enabled');
    }
    if (request.method !== 'POST') {
      throw protocolError('METHOD_NOT_SUPPORTED', 'Batches must use POST');
    }
    const body = await readBody(request);
    if (!Array.isArray(body)) {
      throw protocolError('BAD_REQUEST', 'A batch body must be an array');
    }
    if (body.length > batch.maxItems) {
      throw protocolError(
        'PAYLOAD_TOO_LARGE',
        `A batch can have at most ${batch.maxItems} calls`,
      );
    }
    const calls = (body as BatchCall[]).map((call) => {
      const path = typeof call?.path === 'string' ? call.path : '';
      return {
        path,
        input: call?.input,
        procedure: getProcedure(router, path),
      };
    });
    const ctx = await makeContext(
      request,
      calls.flatMap((c) =>
        c.procedure ? [{ path: c.path, type: c.procedure['~trpc'].type }] : [],
      ),
    );
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener('abort', onAbort, { once: true });

    const one = async (call: (typeof calls)[number]): Promise<CallResult> => {
      try {
        if (!call.procedure) {
          throw protocolError(
            'NOT_FOUND',
            `No procedure at path "${call.path}"`,
          );
        }
        if (call.procedure['~trpc'].type === 'subscription') {
          throw protocolError('BAD_REQUEST', 'Subscriptions cannot be batched');
        }
        return await execute(
          request,
          call.procedure,
          call.path,
          ctx,
          deserializeInput(call.input),
          controller.signal,
        );
      } catch (cause) {
        const err = isTRPCError(cause) ? cause : unexpectedError(cause);
        report(err, request, call.path);
        return { status: err.status, body: wire(err) };
      }
    };

    return linesResponse(
      async (write) => {
        await Promise.all(
          calls.map(async (call, i) => {
            const result = await one(call);
            write({
              i,
              status: result.status,
              body: result.body,
            } satisfies BatchLine);
            if (result.chunks) {
              await runChunks(
                result.chunks,
                (chunk) => write({ i, chunk } satisfies BatchLine),
                controller.signal,
              );
            }
          }),
        );
      },
      controller.signal,
      onAbort,
    );
  }

  return {
    async fetch(request) {
      const url = new URL(request.url);
      try {
        const version = request.headers.get(HEADER.version);
        if (version !== null && version !== PROTOCOL_VERSION) {
          throw protocolError(
            'UNSUPPORTED_PROTOCOL',
            `Unsupported protocol version "${version}", expected "${PROTOCOL_VERSION}"`,
          );
        }
        if (
          url.pathname !== endpoint &&
          !url.pathname.startsWith(`${endpoint}/`)
        ) {
          throw protocolError('NOT_FOUND', `Not found: ${url.pathname}`);
        }
        const rest = url.pathname.slice(endpoint.length + 1);
        if (rest === '' && request.headers.get(HEADER.batch) === '1') {
          return await batched(request);
        }
        return await single(request, url, decodeURIComponent(rest));
      } catch (cause) {
        const err = isTRPCError(cause) ? cause : unexpectedError(cause);
        report(err, request);
        return respond(
          err.status,
          JSON.stringify(wire(err)),
          CONTENT_TYPE.json,
        );
      }
    },
    async dispose() {
      await runtime?.dispose();
    },
  };
}
