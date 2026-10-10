import { Effect, Stream } from 'effect';
import type { AnyTRPCError } from '../../internal/error.ts';
import {
  link,
  runLinks,
  type Operation,
  type OperationStream,
  type TRPCLink,
} from '../link.ts';

const asArray = (links: TRPCLink | ReadonlyArray<TRPCLink>) =>
  Array.isArray(links)
    ? (links as ReadonlyArray<TRPCLink>)
    : [links as TRPCLink];

/**
 * Options for {@link splitLink}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface SplitLinkOptions {
  condition: (op: Operation) => boolean;
  /** The chain for operations where `condition` is true. */
  true: TRPCLink | ReadonlyArray<TRPCLink>;
  /** The chain for the rest. */
  false: TRPCLink | ReadonlyArray<TRPCLink>;
}

/**
 * Routes each operation to one of two chains.
 *
 * @example
 * ```ts
 * splitLink({
 *   condition: (op) => op.type === 'subscription',
 *   true: httpLink({ url }),
 *   false: httpLink({ url, batch: true }),
 * });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function splitLink(opts: SplitLinkOptions): TRPCLink {
  const yes = asArray(opts.true);
  const no = asArray(opts.false);
  return link.effect(({ op }) => runLinks(opts.condition(op) ? yes : no, op));
}

/**
 * A log entry from {@link loggerLink}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export type LoggerEvent =
  | { direction: 'up'; op: Operation }
  | { direction: 'down'; op: Operation; result: unknown; elapsedMs: number }
  | {
      direction: 'error';
      op: Operation;
      error: AnyTRPCError;
      elapsedMs: number;
    };

/**
 * Logs every operation, its results and its errors.
 *
 * @example
 * ```ts
 * loggerLink({ enabled: () => import.meta.env.DEV });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function loggerLink(
  opts: {
    enabled?: (op: Operation) => boolean;
    log?: (event: LoggerEvent) => void;
  } = {},
): TRPCLink {
  const log =
    opts.log ??
    ((event: LoggerEvent) => {
      const { op } = event;
      const label = `${event.direction === 'up' ? '>>' : '<<'} ${op.type} #${op.id} ${op.path}`;
      if (event.direction === 'error') console.error(label, event.error);
      else
        console.log(label, event.direction === 'up' ? op.input : event.result);
    });
  return link.effect(({ op, next }) => {
    if (opts.enabled && !opts.enabled(op)) return next(op);
    const start = Date.now();
    log({ direction: 'up', op });
    return next(op).pipe(
      Stream.tap((result) =>
        Effect.sync(() =>
          log({ direction: 'down', op, result, elapsedMs: Date.now() - start }),
        ),
      ),
      Stream.tapError((error) =>
        Effect.sync(() =>
          log({ direction: 'error', op, error, elapsedMs: Date.now() - start }),
        ),
      ),
    );
  });
}

/**
 * Options for {@link retryLink}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface RetryLinkOptions {
  /** @default 3 */
  retries?: number;
  /** Delay before each retry. @default attempt => 2 ** attempt * 100 */
  delayMs?: (attempt: number) => number;
  /**
   * Whether to retry. By default: queries only, and only errors outside the
   * typed union (network failures, 5xx), never aborts.
   */
  retry?: (opts: {
    op: Operation;
    error: AnyTRPCError;
    attempt: number;
  }) => boolean;
}

const defaultRetry: NonNullable<RetryLinkOptions['retry']> = ({ op, error }) =>
  op.type === 'query' &&
  !error.defined &&
  error.code !== 'CLIENT_CLOSED_REQUEST' &&
  (error.status === 0 || error.status >= 500);

/**
 * Retries failed operations.
 *
 * @example
 * ```ts
 * createTRPCClient<AppRouter>({
 *   links: [retryLink({ retries: 3 }), httpLink({ url })],
 * });
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function retryLink(opts: RetryLinkOptions = {}): TRPCLink {
  const retries = opts.retries ?? 3;
  const delayMs = opts.delayMs ?? ((attempt: number) => 2 ** attempt * 100);
  const shouldRetry = opts.retry ?? defaultRetry;
  return link.effect(({ op, next }) => {
    const attempt = (n: number): OperationStream =>
      Stream.catch(next(op), (error) =>
        n < retries && shouldRetry({ op, error, attempt: n + 1 })
          ? Stream.unwrap(
              Effect.sleep(delayMs(n + 1)).pipe(Effect.as(attempt(n + 1))),
            )
          : Stream.fail(error),
      );
    return attempt(0);
  });
}
