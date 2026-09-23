/**
 * Writes the fixture STLs (binary + ASCII) to tests/fixtures/out/.
 * Usage: pnpm fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, toAsciiStl, toBinaryStl } from './shapes';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(outDir, { recursive: true });

for (const [name, build] of Object.entries(FIXTURES)) {
  const tris = build();
  writeFileSync(join(outDir, `${name}.stl`), Buffer.from(toBinaryStl(tris, name)));
  writeFileSync(join(outDir, `${name}.ascii.stl`), toAsciiStl(tris, name));
  console.log(`${name}: ${tris.length / 9} triangles`);
}
console.log(`wrote ${outDir}`);
