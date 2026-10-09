// Usage (from next/spikes): node effect-bundle/diff-modules.ts <fixtureA> <fixtureB>
// Lists modules (rendered bytes, pre-minify) that only one of two fixtures contains.
import path from 'node:path';
import { rolldown, type OutputChunk } from 'rolldown';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

async function modules(name: string): Promise<Map<string, number>> {
  const bundle = await rolldown({
    input: path.join(fixturesDir, `${name}.ts`),
    platform: 'browser',
    logLevel: 'silent',
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  });
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close();
  const chunk = output.find((o): o is OutputChunk => o.type === 'chunk')!;
  return new Map(
    Object.entries(chunk.modules).map(([id, m]) => [
      id.replace(/^.*node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?/, ''),
      m.renderedLength,
    ]),
  );
}

const [a, b] = process.argv.slice(2);
if (!a || !b) throw new Error('usage: diff-modules.ts <fixtureA> <fixtureB>');
const [ma, mb] = await Promise.all([modules(a), modules(b)]);
for (const [label, x, y] of [
  [a, ma, mb],
  [b, mb, ma],
] as const) {
  console.log(`\nonly or bigger in ${label}:`);
  for (const [id, len] of [...x].sort((p, q) => q[1] - p[1])) {
    const other = y.get(id) ?? 0;
    if (len > other) console.log(`  ${id}: ${len} (vs ${other})`);
  }
}
