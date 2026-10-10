import { TRPCError, type AnyTRPCError } from '../internal/error.ts';

/**
 * The JSON body of an OpenAPI error response.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface OpenAPIErrorBody {
  /** Whether the error is part of the procedure's typed union. */
  readonly defined: boolean;
  readonly code: string;
  readonly status: number;
  readonly message: string;
  readonly data?: unknown;
}

/** @internal */
export const toOpenAPIError = (err: AnyTRPCError): OpenAPIErrorBody => ({
  defined: err.defined,
  code: err.code,
  status: err.status,
  message: err.message,
  ...(err.data === undefined ? {} : { data: err.data }),
});

/** @internal */
export function fromOpenAPIError(body: unknown, status: number): TRPCError {
  const b =
    typeof body === 'object' && body !== null
      ? (body as Partial<OpenAPIErrorBody>)
      : {};
  const code = typeof b.code === 'string' ? b.code : 'INTERNAL_SERVER_ERROR';
  return new TRPCError({
    code,
    message: typeof b.message === 'string' ? b.message : code,
    status: typeof b.status === 'number' ? b.status : status,
    data: b.data,
    defined: b.defined === true,
  });
}
