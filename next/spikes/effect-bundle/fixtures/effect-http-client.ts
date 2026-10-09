// Same as Effect's packages/tools/bundle/fixtures/http-client.ts: what using
// `effect/http` for transport would cost.
import * as Effect from 'effect/Effect';
import * as FetchHttpClient from 'effect/http/FetchHttpClient';
import * as HttpClient from 'effect/http/HttpClient';

void Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const res = yield* client.get('https://example.com/trpc/post.byId');
  yield* res.json;
}).pipe(Effect.provide(FetchHttpClient.layer), Effect.runPromise);
