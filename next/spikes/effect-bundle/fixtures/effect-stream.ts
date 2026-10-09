// Same as Effect's packages/tools/bundle/fixtures/stream.ts (calibration).
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

Stream.range(1, 100_000).pipe(Stream.runDrain, Effect.runSync);
