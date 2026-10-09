/**
 * Usage: `node danson/compare.ts` from `spikes/`.
 * URL lengths for QP-A / QP-B / QP-C, and rough encode/decode throughput.
 */
import * as original from 'danson';
import { fromSearch, toQueryEntries, toSearch } from './query.ts';
import { deserializers, serializers } from './std.ts';
import { parseSync, serializeSync, stringifySync } from './sync.ts';

const ser = { serializers };
const de = { deserializers };

const inputs: Record<string, unknown> = {
  'proposal 11 example': {
    id: 1,
    q: 'hello world',
    tags: ['a', 'b'],
    since: new Date('2026-10-09'),
    filter: { status: 'open', archived: false },
  },
  'byId { id }': { id: 'post_123' },
  'paginated list': {
    cursor: 'eyJpZCI6MTAwfQ',
    limit: 20,
    sort: { by: 'createdAt', dir: 'desc' },
  },
  'search w/ arrays': {
    q: 'trpc effect',
    labels: ['bug', 'help wanted', 'good first issue'],
    authors: [{ login: 'katt' }, { login: 'juliusmarminge' }],
    range: { from: new Date(0), to: new Date('2026-01-01') },
  },
};

const qpA = (v: unknown) =>
  new URLSearchParams({
    input: JSON.stringify(serializeSync(v, ser)),
  }).toString();
const qpB = (v: unknown) => {
  const { json } = serializeSync(v, ser) as { json: Record<string, unknown> };
  return new URLSearchParams(
    Object.entries(json).map(([k, x]) => [
      k,
      typeof x === 'string' ? x : JSON.stringify(x),
    ]),
  ).toString();
};
const qpCStd = (v: unknown) =>
  new URLSearchParams(toQueryEntries(v, ser)).toString();

console.log('## URL query length (bytes)\n');
console.log(
  '| input | QP-A | QP-B | QP-C (URLSearchParams) | QP-C (legible) |',
);
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const [name, v] of Object.entries(inputs)) {
  console.log(
    `| ${name} | ${qpA(v).length} | ${qpB(v).length} | ${qpCStd(v).length} | ${toSearch(v, ser).length} |`,
  );
}
console.log('\n## Legible QP-C strings\n');
for (const [name, v] of Object.entries(inputs)) {
  console.log(`- ${name}: \`?${toSearch(v, ser)}\``);
}

function bench(label: string, fn: () => unknown, ms = 400) {
  for (let i = 0; i < 2000; i++) fn();
  let n = 0;
  const start = performance.now();
  while (performance.now() - start < ms) {
    for (let i = 0; i < 200; i++) fn();
    n += 200;
  }
  const opsPerSec = Math.round((n / (performance.now() - start)) * 1000);
  console.log(`| ${label} | ${opsPerSec.toLocaleString('en-US')} |`);
}

const v = inputs['search w/ arrays'];
const search = toSearch(v, ser);
const a = qpA(v);
const text = stringifySync(v, ser);
console.log('\n## Throughput, "search w/ arrays" input (ops/s, single run)\n');
console.log('| operation | ops/s |');
console.log('| --- | ---: |');
bench('JSON.stringify (no rich types)', () => JSON.stringify(v));
bench('port stringifySync', () => stringifySync(v, ser));
bench('danson stringifySync', () => original.stringifySync(v, ser));
bench('port parseSync', () => parseSync(text, de));
bench('danson parseSync', () => original.parseSync(text, de));
bench('QP-A encode', () => qpA(v));
bench('QP-C encode (legible)', () => toSearch(v, ser));
bench('QP-A decode', () => parseSync(new URLSearchParams(a).get('input')!, de));
bench('QP-C decode', () => fromSearch(search, de));
