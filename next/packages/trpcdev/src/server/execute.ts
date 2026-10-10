import { Cause, Context, Effect, Exit, Stream } from 'effect';
import {
  isTRPCError,
  TRPCError,
  withDefined,
  type AnyTRPCError,
} from '../internal/error.ts';
import type { AnyProcedure } from './procedure.ts';
import { inputError, isSchema, outputError, validate } from './schema.ts';
import { isTracked, tracked } from './tracked.ts';

const unexpectedErrors = new WeakSet<AnyTRPCError>();

/** Wraps a thrown non-`TRPCError` value. Its message is masked in production. @internal */
export function unexpectedError(cause: unknown): AnyTRPCError {
  const err = new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: cause instanceof Error ? cause.message : 'Internal server error',
    cause,
  });
  unexpectedErrors.add(err);
  return err;
}

/** Whether the error wraps something that was not a `TRPCError`. @internal */
export const isUnexpectedError = (err: AnyTRPCError): boolean =>
  unexpectedErrors.has(err);

/**
 * The one error a failed call surfaces. Failures in the error channel are
 * typed (`defined`) errors. Defects are thrown values: a thrown `TRPCError`
 * keeps its code but is `defined: false`, anything else is unexpected.
 * @internal
 */
export function normalizeCause(cause: Cause.Cause<unknown>): AnyTRPCError {
  for (const reason of cause.reasons) {
    if (Cause.isFailReason(reason)) {
      return isTRPCError(reason.error)
        ? reason.error
        : unexpectedError(reason.error);
    }
  }
  for (const reason of cause.reasons) {
    if (Cause.isDieReason(reason)) {
      return isTRPCError(reason.defect)
        ? withDefined(reason.defect, false)
        : unexpectedError(reason.defect);
    }
  }
  return new TRPCError({
    code: 'CLIENT_CLOSED_REQUEST',
    message: 'The request was aborted',
  });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  typeof value === 'object' && value !== null && Symbol.asyncIterator in value;

/** Typed `TRPCError` failures stay failures; anything else is a defect (02 d.i). */
const refail = <A, R>(
  effect: Effect.Effect<A, unknown, R>,
): Effect.Effect<A, AnyTRPCError, R> =>
  Effect.catchCause(effect, (cause) =>
    Effect.failCause(
      Cause.fromReasons(
        cause.reasons.map((reason) =>
          Cause.isFailReason(reason)
            ? isTRPCError(reason.error)
              ? Cause.makeFailReason(withDefined(reason.error, true))
              : Cause.makeDieReason(reason.error)
            : reason,
        ),
      ) as Cause.Cause<AnyTRPCError>,
    ),
  );

const fail = (err: AnyTRPCError) => Effect.fail(withDefined(err, true));

/** @internal */
export interface CallOpts {
  readonly procedure: AnyProcedure;
  readonly path: string;
  readonly ctx: object;
  /** The deserialized, unvalidated input. */
  readonly input: unknown;
  readonly signal: AbortSignal;
  readonly lastEventId?: string | undefined;
}

const MIDDLEWARE_CAUSE = Symbol('trpc.middlewareCause');

/**
 * Runs a call: middleware, inputs, `.provide()` steps, the resolver and
 * output validation. Fails with typed `TRPCError`s; thrown values are
 * defects. A subscription succeeds with a `Stream` of events.
 * @internal
 */
export function callProcedure(
  opts: CallOpts,
): Effect.Effect<unknown, AnyTRPCError, any> {
  const def = opts.procedure['~trpc'];
  const { path, signal } = opts;
  const { meta, type } = def;

  const run = (
    i: number,
    ctx: object,
    input: unknown,
  ): Effect.Effect<unknown, AnyTRPCError, any> =>
    Effect.suspend(() => {
      const step = def.steps[i];
      if (!step) return resolve(ctx, input);
      switch (step.kind) {
        case 'input':
          return Effect.gen(function* () {
            const schema = isSchema(step.arg)
              ? step.arg
              : yield* Effect.try({
                  try: () =>
                    (step.arg as (o: unknown) => unknown)({
                      ctx,
                      meta,
                      path,
                      type,
                    }),
                  catch: (cause) => cause,
                }).pipe(Effect.orDie);
            const parsed = yield* validate(
              schema as never,
              opts.input,
              inputError,
            );
            return yield* run(
              i + 1,
              ctx,
              isPlainObject(input) && isPlainObject(parsed)
                ? { ...input, ...parsed }
                : parsed,
            );
          });
        case 'provide':
          return Effect.gen(function* () {
            const made = yield* Effect.promise(async () =>
              step.make({ ctx, input, meta, path }),
            );
            const value = Effect.isEffect(made)
              ? yield* refail(made as Effect.Effect<unknown, unknown, any>)
              : made;
            return yield* run(i + 1, ctx, input).pipe(
              Effect.provideService(step.key, value),
            );
          });
        case 'use':
          return Effect.gen(function* () {
            const services = yield* Effect.context<never>();
            const runNext = Effect.runPromiseExitWith(services);
            const next = async (o?: { ctx?: object }) => {
              const exit = await runNext(
                run(
                  i + 1,
                  o?.ctx ? { ...ctx, ...o.ctx } : ctx,
                  input,
                ) as Effect.Effect<unknown, AnyTRPCError>,
                { signal },
              );
              return Exit.isSuccess(exit)
                ? { ok: true, data: exit.value }
                : {
                    ok: false,
                    error: normalizeCause(exit.cause),
                    [MIDDLEWARE_CAUSE]: exit.cause,
                  };
            };
            const ret: unknown = yield* Effect.promise(async () =>
              step.fn({ ctx, input, meta, path, type, signal, next }),
            );
            if (isTRPCError(ret)) return yield* fail(ret);
            if (typeof ret === 'object' && ret !== null && 'ok' in ret) {
              if (ret.ok) return (ret as unknown as { data: unknown }).data;
              const cause = (
                ret as { [MIDDLEWARE_CAUSE]?: Cause.Cause<never> }
              )[MIDDLEWARE_CAUSE];
              return yield* cause
                ? Effect.failCause(cause)
                : fail((ret as unknown as { error: AnyTRPCError }).error);
            }
            return yield* Effect.die(
              new Error(
                `Middleware on "${path}" must return next() or a TRPCError`,
              ),
            );
          });
      }
    });

  const resolve = (ctx: object, input: unknown) =>
    Effect.gen(function* () {
      let ret: unknown = yield* Effect.promise(async () =>
        def.resolver({
          ctx,
          input,
          meta,
          path,
          type,
          signal,
          ...(type === 'subscription' ? { lastEventId: opts.lastEventId } : {}),
        }),
      );
      if (isTRPCError(ret)) return yield* fail(ret);
      if (Effect.isEffect(ret)) {
        ret = yield* refail(ret as Effect.Effect<unknown, unknown, any>);
        if (isTRPCError(ret)) return yield* fail(ret);
      }
      const services = yield* Effect.context<never>();
      if (type === 'subscription')
        return toEventStream(ret, services, def.output);
      if (Stream.isStream(ret)) {
        ret = Stream.toAsyncIterableWith(
          ret as Stream.Stream<unknown, unknown, never>,
          services,
        );
      }
      if (def.output) return yield* validate(def.output, ret, outputError);
      return ret;
    });

  return run(0, opts.ctx, undefined);
}

function toEventStream(
  value: unknown,
  services: Context.Context<never>,
  output: AnyProcedure['~trpc']['output'],
): Stream.Stream<unknown, AnyTRPCError> {
  let stream: Stream.Stream<unknown, AnyTRPCError, any>;
  if (Stream.isStream(value)) {
    stream = Stream.catchCause(
      value as Stream.Stream<unknown, unknown, any>,
      (cause) => Stream.fromEffect(refail(Effect.failCause(cause))),
    );
  } else if (isAsyncIterable(value)) {
    stream = Stream.orDie(Stream.fromAsyncIterable(value, (cause) => cause));
  } else {
    return Stream.die(
      new Error('A subscription must return an AsyncIterable or a Stream'),
    );
  }
  if (output) {
    stream = Stream.mapEffect(stream, (event) =>
      isTracked(event)
        ? Effect.map(validate(output, event.data, outputError), (data) =>
            tracked(event.id, data),
          )
        : validate(output, event, outputError),
    );
  }
  return Stream.provideContext(stream, services) as Stream.Stream<
    unknown,
    AnyTRPCError
  >;
}
