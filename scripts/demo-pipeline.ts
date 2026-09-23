/**
 * Runs the full Studio pipeline (WS-A geometry + WS-B mat) in Node on every
 * fixture STL and writes the outputs to tests/fixtures/out/demo/<name>/ for
 * eyeballing: model.glb, mat.svg, mat.pdf, marker PNGs, qr.png, instructions.
 *
 * Usage: pnpm demo
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restingRotation } from '../src/lib/geometry/orient';
import { loadModel, prepareModel } from '../src/lib/geometry/pipeline';
import { formatDimsMm } from '../src/lib/geometry/scale';
import { generateMat } from '../src/lib/mat/generate';
import { FIXTURES, toBinaryStl } from '../tests/fixtures/shapes';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'tests/fixtures/out/demo');

for (const [name, build] of Object.entries(FIXTURES)) {
  const t0 = performance.now();
  const loaded = await loadModel(toBinaryStl(build()), 1);
  // tripod: rest on its feet like an exhibitor would, not on the (larger) plate top
  const best =
    name === 'tripod' ? loaded.candidates.find((c) => c.asPrinted)! : loaded.candidates[0]!;
  const prepared = await prepareModel(loaded.meshMm, restingRotation(best.normal));
  const mat = generateMat({
    projectId: `demo-${name}`,
    geometryVersion: 1,
    title: `Demo: ${name}`,
    siteUrl: 'https://exhibitar.vercel.app',
    contactOutlineMm: prepared.footprint.contactOutlineMm,
    shadowOutlineMm: prepared.footprint.shadowOutlineMm,
    contactWeak: prepared.footprint.contactWeak,
  });

  const dir = join(outRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'model.glb'), prepared.glb);
  writeFileSync(join(dir, 'mat.svg'), mat.svg);
  writeFileSync(join(dir, 'mat.pdf'), mat.pdf);
  writeFileSync(join(dir, 'qr.png'), mat.qrPng);
  writeFileSync(join(dir, 'instructions.txt'), mat.instructions);
  for (const m of mat.markerPngs) writeFileSync(join(dir, `marker-${m.id}.png`), m.png);
  for (const t of mat.tileSvgs) writeFileSync(join(dir, `tile-${t.label}.svg`), t.svg);

  console.log(
    `${name.padEnd(15)} ${formatDimsMm(prepared.boundsMm.size).padEnd(22)} ` +
      `${String(prepared.triangleCount).padStart(6)} tris  glb ${(prepared.glb.byteLength / 1024).toFixed(1)} KB  ` +
      `contact ${prepared.footprint.contactAreaMm2.toFixed(0)} mm²${prepared.footprint.contactWeak ? ' (weak)' : ''}  ` +
      `mat ${mat.meta.paper} ${mat.meta.orientation} ${mat.meta.tiles.cols}×${mat.meta.tiles.rows}  ` +
      `${mat.meta.markers.length} markers  ${(performance.now() - t0).toFixed(0)} ms`,
  );
}
console.log(`wrote ${outRoot}`);
