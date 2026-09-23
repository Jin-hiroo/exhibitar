/**
 * Sample STLs for "Try a sample" in the Studio: public/samples/*.stl.
 * Usage: pnpm samples
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, toBinaryStl } from '../tests/fixtures/shapes';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples');
mkdirSync(out, { recursive: true });
for (const [name, build] of Object.entries(FIXTURES)) {
  writeFileSync(join(out, `${name}.stl`), Buffer.from(toBinaryStl(build(), name)));
}
console.log(`wrote ${Object.keys(FIXTURES).length} samples to ${out}`);
