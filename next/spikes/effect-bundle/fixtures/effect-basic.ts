// Same as Effect's packages/tools/bundle/fixtures/basic.ts (calibration).
import * as Effect from 'effect/Effect';

Effect.succeed(123).pipe(Effect.runFork);
