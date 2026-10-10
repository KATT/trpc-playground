import {
  generateOpenAPI,
  type GenerateOpenAPIOptions,
  type OpenAPIDocument,
} from './generate.ts';
import type { OpenAPIPlugin } from './handler.ts';

/**
 * The options of {@link openAPIReference}.
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export interface OpenAPIReferenceOptions {
  /**
   * Where the docs UI is served, under the handler's prefix.
   * @default '/docs'
   */
  path?: `/${string}`;
  /**
   * Where the document is served, under the handler's prefix.
   * @default '/openapi.json'
   */
  specPath?: `/${string}`;
  /** @default 'scalar' */
  docsProvider?: 'scalar' | 'swagger';
  /**
   * Options for {@link generateOpenAPI}. `servers` defaults to the request's
   * origin; `prefix` to the handler's.
   */
  specGenerateOptions: GenerateOpenAPIOptions;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

function page(
  provider: 'scalar' | 'swagger',
  title: string,
  specUrl: string,
): string {
  const head = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>`;
  if (provider === 'swagger') {
    return `${head}<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({ url: ${JSON.stringify(specUrl).replace(/</g, '\\u003c')}, dom_id: '#swagger-ui' });</script></body></html>`;
  }
  return `${head}</head><body><script id="api-reference" data-url="${escapeHtml(specUrl)}"></script><script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script></body></html>`;
}

/**
 * Serves an API reference UI (Scalar by default, or Swagger UI, from a CDN)
 * and the OpenAPI document, as a plugin of {@link createOpenAPIHandler}
 * (18 (e)). The document is generated once, on the first request.
 *
 * @example
 * ```ts
 * createOpenAPIHandler({
 *   router: appRouter,
 *   plugins: [
 *     openAPIReference({ specGenerateOptions: { info: { title: 'API', version: '1.0.0' } } }),
 *   ],
 * });
 * // GET /api/docs (UI), GET /api/openapi.json (document)
 * ```
 * @since 12.0.0-alpha.0
 * @stability experimental
 */
export function openAPIReference(opts: OpenAPIReferenceOptions): OpenAPIPlugin {
  const docsPath = opts.path ?? '/docs';
  const specPath = opts.specPath ?? '/openapi.json';
  let spec: Omit<OpenAPIDocument, 'servers'> | undefined;
  return {
    fetch(request, { router, prefix }) {
      if (request.method !== 'GET') return undefined;
      const url = new URL(request.url);
      if (url.pathname === `${prefix}${specPath}`) {
        spec ??= generateOpenAPI(router, {
          prefix,
          ...opts.specGenerateOptions,
        });
        const document = {
          ...spec,
          servers: opts.specGenerateOptions.servers ?? [{ url: url.origin }],
        };
        return new Response(JSON.stringify(document), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.pathname === `${prefix}${docsPath}`) {
        return new Response(
          page(
            opts.docsProvider ?? 'scalar',
            opts.specGenerateOptions.info.title,
            `${prefix}${specPath}`,
          ),
          { headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      }
      return undefined;
    },
  };
}
