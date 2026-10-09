// Usage (from next/spikes): node effect-bundle/measure.ts [--modules name] [--write]
//
// Bundles every fixture with rolldown (ESM, browser, tree-shaken, minified,
// NODE_ENV=production) and reports minified, gzip -9 and brotli sizes.
// Mirrors Effect's packages/tools/bundle (Rollup + terser + gzip -9).
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { rolldown, type OutputChunk } from 'rolldown';

const here = import.meta.dirname;
const fixturesDir = path.join(here, 'fixtures');
const distDir = path.join(here, '..', 'dist', 'effect-bundle');

const args = process.argv.slice(2);
const modulesFor = args.includes('--modules')
  ? args[args.indexOf('--modules') + 1]
  : undefined;
const write = args.includes('--write');

interface Result {
  name: string;
  minified: number;
  gzip: number;
  brotli: number;
  chunk: OutputChunk;
}

async function measure(file: string): Promise<Result> {
  const bundle = await rolldown({
    input: path.join(fixturesDir, file),
    platform: 'browser',
    treeshake: true,
    logLevel: 'silent',
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  });
  const { output } = await bundle.generate({ format: 'esm', minify: true });
  await bundle.close();
  const chunks = output.filter((o): o is OutputChunk => o.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`${file}: expected one chunk`);
  const chunk = chunks[0]!;
  const code = Buffer.from(chunk.code);
  if (write) {
    mkdirSync(distDir, { recursive: true });
    writeFileSync(path.join(distDir, file.replace(/\.ts$/, '.js')), code);
  }
  return {
    name: file.replace(/\.ts$/, ''),
    minified: code.length,
    gzip: gzipSync(code, { level: 9 }).length,
    brotli: brotliCompressSync(code, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
    chunk,
  };
}

const kb = (n: number) => (n / 1024).toFixed(2);

function moduleGroup(id: string): string {
  const pkg =
    /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\/(.*)$/.exec(
      id,
    );
  if (pkg) {
    const [, name, rest] = pkg;
    return name === 'effect'
      ? `effect/${rest!.replace(/^dist\//, '')}`
      : `${name}/${rest}`;
  }
  return path.relative(path.join(here, '..'), id);
}

const files = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.ts'))
  .sort();
const results: Result[] = [];
for (const file of files) results.push(await measure(file));

console.log('| fixture | min (KB) | min+gzip (KB) | min+brotli (KB) |');
console.log('| --- | ---: | ---: | ---: |');
for (const r of results) {
  console.log(
    `| \`${r.name}\` | ${kb(r.minified)} | ${kb(r.gzip)} | ${kb(r.brotli)} |`,
  );
}

if (modulesFor) {
  const r = results.find((x) => x.name === modulesFor);
  if (!r) throw new Error(`no fixture named ${modulesFor}`);
  const rows = Object.entries(r.chunk.modules)
    .map(([id, m]) => [moduleGroup(id), m.renderedLength] as const)
    .filter(([, len]) => len > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, len]) => sum + len, 0);
  console.log(`\n${modulesFor}: rendered (pre-minify) bytes by module\n`);
  console.log('| module | bytes | share |');
  console.log('| --- | ---: | ---: |');
  for (const [id, len] of rows.slice(0, 25)) {
    console.log(`| ${id} | ${len} | ${((len / total) * 100).toFixed(1)}% |`);
  }
  console.log(`| (${rows.length} modules) | ${total} | |`);
}
