/**
 * Usage: `node builder-generics/bench.ts [n=1000] [runs=5]` from `spikes/`.
 *
 * For each variant: generate the fixture, run `tsc --extendedDiagnostics
 * --singleThreaded` `runs` times (median reported), and measure the emitted
 * `.d.ts` size of the router file.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, variants } from './generate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const tsc = join(here, '../node_modules/.bin/tsc');
const n = Number(process.argv[2] ?? 1000);
const runs = Number(process.argv[3] ?? 5);

const metrics = [
  'Types',
  'Instantiations',
  'Memory used',
  'Check time',
  'Total time',
] as const;

function parse(out: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of out.split('\n')) {
    const m = /^([A-Za-z ]+):\s+([\d.]+)/.exec(line.trim());
    if (m) result[m[1]!.trim()] = Number(m[2]);
  }
  return result;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

function dtsBytes(dir: string): number {
  const dist = join(dir, 'dist', 'generated', dir.split('/').pop()!);
  return readdirSync(dist)
    .filter((f) => f.endsWith('.d.ts') && f !== 'client.d.ts')
    .reduce((sum, f) => sum + statSync(join(dist, f)).size, 0);
}

const rows: string[] = [];
for (const variant of variants) {
  const dir = generate(variant, n, join(here, 'generated'));
  const samples: Record<string, number>[] = [];
  for (let r = 0; r < runs; r++) {
    let out: string;
    try {
      out = execFileSync(
        tsc,
        [
          '-p',
          join(dir, 'tsconfig.json'),
          '--extendedDiagnostics',
          '--singleThreaded',
        ],
        { encoding: 'utf8' },
      );
    } catch (err) {
      const e = err as { stdout?: string };
      console.error(`${variant}: tsc failed\n${e.stdout?.slice(0, 4000)}`);
      process.exit(1);
    }
    samples.push(parse(out));
  }
  const med = Object.fromEntries(
    metrics.map((k) => [k, median(samples.map((s) => s[k] ?? NaN))]),
  );
  const routerDts = readFileSync(
    join(dir, 'dist', 'generated', `${variant}-${n}`, 'router0.d.ts'),
    'utf8',
  );
  rows.push(
    `| ${variant} | ${n} | ${med['Types']} | ${med['Instantiations']} | ${Math.round(med['Memory used']! / 1024)} MB | ${med['Check time']}s | ${med['Total time']}s | ${Math.round(dtsBytes(dir) / 1024)} KB | ${routerDts.length} B |`,
  );
  console.error(`done: ${variant}`);
}

console.log(
  '| variant | procedures | types | instantiations | memory | check (median) | total (median) | .d.ts (routers) | router0.d.ts |',
);
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
console.log(rows.join('\n'));
