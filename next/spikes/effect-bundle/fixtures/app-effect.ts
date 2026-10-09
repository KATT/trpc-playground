// A typical Effect browser app before adding tRPC: Effect.gen, Stream, Schema,
// retry with a schedule.
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';

const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String });

export const program = Effect.gen(function* () {
  const res = yield* Effect.tryPromise(() => fetch('/todos/1'));
  const json = yield* Effect.tryPromise(() => res.json());
  const todo = yield* Schema.decodeUnknownEffect(Todo)(json);
  yield* Stream.make(1, 2, 3).pipe(
    Stream.map((n) => n * todo.id),
    Stream.runForEach((n) => Effect.log(n)),
  );
  return todo;
}).pipe(
  Effect.retry(Schedule.exponential('100 millis')),
  Effect.timeout('5 seconds'),
);

export const run = () => Effect.runPromise(program);
