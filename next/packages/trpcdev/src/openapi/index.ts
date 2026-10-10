/**
 * OpenAPI (`trpcdev/openapi`, 18): serve a router over REST, generate an
 * OpenAPI 3.1 document from its schemas, serve an API reference UI, and call
 * REST endpoints with the tRPC client.
 *
 * @example
 * ```ts
 * import { createOpenAPIHandler, generateOpenAPI, openAPIReference } from 'trpcdev/openapi';
 *
 * const byId = t.procedure
 *   .route({ method: 'GET', path: '/posts/{id}', tags: ['posts'] })
 *   .input(z.object({ id: z.string() }))
 *   .errors({ NOT_FOUND: { data: z.object({ id: z.string() }) } })
 *   .query(…);
 *
 * export const openapi = createOpenAPIHandler({
 *   router: appRouter,
 *   plugins: [openAPIReference({ specGenerateOptions: { info: { title: 'API', version: '1.0.0' } } })],
 * });
 * // GET /api/posts/1 → 200 { id, title } or 404 { defined, code: 'NOT_FOUND', data: { id } }
 * ```
 * @see ../../../../.agent-docs/proposals/18-openapi.md
 * @module
 */
export { parseBracketNotation, toBracketNotation } from './bracket.ts';
export { coerceBySchema } from './coerce.ts';
export type { OpenAPIErrorBody } from './errors.ts';
export {
  generateOpenAPI,
  type GenerateOpenAPIOptions,
  type OpenAPIDocument,
  type OpenAPIInfo,
  type OpenAPIOperation,
  type OpenAPIServer,
} from './generate.ts';
export {
  createOpenAPIHandler,
  type BaseOpenAPIHandlerOptions,
  type OpenAPIHandler,
  type OpenAPIHandlerOptions,
  type OpenAPIPlugin,
  type OpenAPIPluginContext,
} from './handler.ts';
export { openAPILink, type OpenAPILinkOptions } from './link.ts';
export { openAPIReference, type OpenAPIReferenceOptions } from './reference.ts';
export type { HTTPMethod, ResolvedRoute } from './routes.ts';
export type { JSONSchema } from '../internal/json-schema.ts';
