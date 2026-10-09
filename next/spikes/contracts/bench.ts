/**
 * Usage: `node contracts/bench.ts [n=1000] [runs=5]` from `spikes/`.
 *
 * For each variant: generate the fixture and run `tsc --extendedDiagnostics
 * --singleThreaded` `runs` times; medians are reported.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { generate, variants } from './generate.ts';

const here = import.meta.dirname;
const tsc = join(here, '../node_modules/.bin/tsc');
const n = Number(process.argv[2] ?? 1000);
const runs = Number(process.argv[3] ?? 5);

function parse(out: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of out.split('\n')) {
    const m = /^([A-Za-z ]+):\s+([\d.]+)/.exec(line.trim());
    if (m) result[m[1]!.trim()] = Number(m[2]);
  }
  return result;
}

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

console.log(
  '| variant | procedures | types | instantiations | memory | check (median) |',
);
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const variant of variants) {
  const dir = generate(variant, n, join(here, 'generated'));
  const samples: Record<string, number>[] = [];
  for (let r = 0; r < runs; r++) {
    try {
      samples.push(
        parse(
          execFileSync(
            tsc,
            [
              '-p',
              join(dir, 'tsconfig.json'),
              '--extendedDiagnostics',
              '--singleThreaded',
            ],
            {
              encoding: 'utf8',
            },
          ),
        ),
      );
    } catch (err) {
      console.error(
        `${variant}: tsc failed\n${(err as { stdout?: string }).stdout?.slice(0, 4000)}`,
      );
      process.exit(1);
    }
  }
  const m = (k: string) => median(samples.map((s) => s[k] ?? NaN));
  console.log(
    `| ${variant} | ${n} | ${m('Types')} | ${m('Instantiations')} | ${Math.round(m('Memory used') / 1024)} MB | ${m('Check time')}s |`,
  );
}
