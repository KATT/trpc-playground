/**
 * Usage: `node link-options/bench.ts [n=1000] [runs=5]` from `spikes/`.
 *
 * Reuses the positional 1k-procedure router from `builder-generics` and
 * compares client files that call every procedure through:
 * - `plain`: `createClient<AppRouter>()` with no link-declared options;
 * - `d-a` / `d-c`: link-informed clients with 5 links, passing call options on every call.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../builder-generics/generate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const tsc = join(here, '../node_modules/.bin/tsc');
const n = Number(process.argv[2] ?? 1000);
const runs = Number(process.argv[3] ?? 5);
const dir = generate(
  'positional',
  n,
  join(here, '../builder-generics/generated'),
);

const links = `[cacheLink(), retryLink(), loggerLink(), httpLink({ url: '/trpc' }), splitLink({ condition: (op) => op.path === 'r0.p0', true: loggerLink(), false: loggerLink() })]`;
const setup = {
  plain: `import { createClient } from '../../positional.ts';
const client = createClient<AppRouter>();
void 0;`,
  'd-a': `import { createClientA } from '../../../link-options/variants.ts';
import { cacheLink, httpLink, loggerLink, retryLink, splitLink } from '../../../link-options/core.ts';
const client = createClientA<AppRouter>()({ links: ${links} });
const opts = { ignoreCache: true, retries: 2, context: { headers: {} } };`,
  'd-c': `import { createClientC } from '../../../link-options/variants.ts';
import { cacheLink, httpLink, loggerLink, retryLink, splitLink, type } from '../../../link-options/core.ts';
const client = createClientC({ router: type<AppRouter>(), links: ${links} });
const opts = { ignoreCache: true, retries: 2, context: { headers: {} } };`,
};

function call(i: number, withOpts: boolean): string {
  const o = withOpts ? ', opts' : '';
  const path = `client.r${Math.floor(i / 10)}.p${i % 10}`;
  switch (i % 5) {
    case 0:
      return `void ${path}.query(undefined${o});`;
    case 1:
      return `void ${path}.query({ id: 'a', f${i}: 1 }${o});`;
    case 2:
      return `void ${path}.mutate({ title: 'a', m${i}: 'b' }${o});`;
    case 3:
      return `void ${path}.query({ a${i}: 1, b${i}: 'x' }${o});`;
    default:
      return `void ${path}.query(undefined${o});`;
  }
}

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

console.log('| client | instantiations | check (median) |');
console.log('| --- | ---: | ---: |');
for (const [name, head] of Object.entries(setup)) {
  writeFileSync(
    join(dir, `links-${name}.ts`),
    `import type { AppRouter } from './router.ts';
${head}
${Array.from({ length: n }, (_, i) => call(i, name !== 'plain')).join('\n')}
`,
  );
  const tsconfig = join(dir, `tsconfig.links-${name}.json`);
  writeFileSync(
    tsconfig,
    JSON.stringify({
      extends: '../../../../tsconfig.json',
      compilerOptions: { allowImportingTsExtensions: true },
      files: [`links-${name}.ts`],
    }),
  );
  const samples = Array.from({ length: runs }, () => {
    const out = execFileSync(
      tsc,
      ['-p', tsconfig, '--extendedDiagnostics', '--singleThreaded'],
      {
        encoding: 'utf8',
      },
    );
    return {
      inst: Number(/Instantiations:\s+(\d+)/.exec(out)![1]),
      check: Number(/Check time:\s+([\d.]+)/.exec(out)![1]),
    };
  });
  console.log(
    `| ${name} | ${samples[0]!.inst} | ${median(samples.map((s) => s.check))}s |`,
  );
}
