/**
 * How trackable are our mats? Generates mats for the mock project and for any
 * given outlines, writes the tracking images (corner markers, the whole page)
 * plus "bands" cut from the page (the strip between two markers along each
 * edge), and scores them with Google's `arcoreimg` when available.
 *
 * Each case is generated three ways:
 *   printed  60 mm markers, no texture: mats published before the texture
 *   plain    current layout (bigger markers), texture off
 *   new      current layout with the tracking texture (what Studio publishes)
 *
 * Usage:
 *   pnpm track-scores [--out DIR] [outline.json ...]
 *   ARCOREIMG=/path/to/arcoreimg pnpm track-scores …   # adds scores
 *
 * Scores are 0–100 (Google recommends ≥ 75); FAIL means arcoreimg found too
 * few keypoints at all, which is when ARCore reports the image as untrackable
 * (docs/D0-FINDINGS.md §4). The score varies a lot with small changes to an
 * image, so compare variants over several outlines, not one number.
 *
 * An outline file is JSON with `contactOutlineMm` and `shadowOutlineMm` (mat XZ, mm),
 * optionally `title`, `paper` (picks the ISO/US family), `id` and `geometryVersion`
 * (to reproduce a published mat exactly); a project's `mat` column works too.
 * arcoreimg: github.com/google-ar/arcore-android-sdk, tools/arcoreimg/<os>/arcoreimg
 * (never committed).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzlibSync } from 'fflate';
import { footprintStats } from '../src/lib/geometry/footprint-stats';
import type { Polygons } from '../src/lib/geometry/polygons';
import type { Rect } from '../src/lib/mat/display-list';
import { generateMat, type MatInput } from '../src/lib/mat/generate';
import { DEFAULT_MARKER_WIDTH_MM, MARKER_QUIET_MM, type MatLayout } from '../src/lib/mat/layout';
import type { PaperName } from '../src/lib/mat/paper';
import { encodePng } from '../src/lib/mat/png';
import { createRaster, type Raster } from '../src/lib/mat/raster';
import type { Project } from '../src/lib/types';

/** ARCore wants reference images at least this many pixels on their short side. */
const MIN_IMAGE_PX = 300;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outDir =
  outFlag >= 0 ? args.splice(outFlag, 2)[1]! : join(root, 'tests/fixtures/out/track-scores');
const arcoreimg = process.env.ARCOREIMG;

interface Case {
  name: string;
  id: string;
  geometryVersion: number;
  title: string;
  paper?: PaperName;
  contactOutlineMm: Polygons;
  shadowOutlineMm: Polygons;
}

const mock = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/project.mock.json'), 'utf8'),
) as Project;
const cases: Case[] = [
  {
    name: 'mock',
    id: mock.id,
    geometryVersion: mock.geometryVersion,
    title: mock.title,
    paper: mock.mat.paper,
    contactOutlineMm: mock.mat.contactOutlineMm,
    shadowOutlineMm: mock.mat.shadowOutlineMm,
  },
  ...args.map((file): Case => {
    const j = JSON.parse(readFileSync(file, 'utf8')) as Partial<Case> & { mat?: Partial<Case> };
    const src = { ...j.mat, ...j };
    if (!src.contactOutlineMm || !src.shadowOutlineMm) throw new Error(`${file}: no outlines`);
    return {
      name: basename(file).replace(/\.json$/, ''),
      id: src.id ?? 'scores',
      geometryVersion: src.geometryVersion ?? 1,
      title: src.title ?? 'Exhibit',
      paper: src.paper,
      contactOutlineMm: src.contactOutlineMm,
      shadowOutlineMm: src.shadowOutlineMm,
    };
  }),
];

const variants: { name: string; input: Partial<MatInput> }[] = [
  { name: 'printed', input: { texture: false, markerWidthMm: DEFAULT_MARKER_WIDTH_MM } },
  { name: 'plain', input: { texture: false } },
  { name: 'new', input: {} },
];

interface Row {
  mat: string;
  image: string;
  px: string;
  mm: string;
  file: string;
}
const rows: Row[] = [];

for (const c of cases) {
  for (const v of variants) {
    const mat = generateMat({
      projectId: c.id,
      geometryVersion: c.geometryVersion,
      title: c.title,
      siteUrl: 'https://exhibitar.vercel.app',
      contactOutlineMm: c.contactOutlineMm,
      shadowOutlineMm: c.shadowOutlineMm,
      contactWeak: footprintStats(c.contactOutlineMm, c.shadowOutlineMm).contactWeak,
      paperPreference: c.paper === 'Letter' || c.paper === 'Tabloid' ? 'us' : 'iso',
      ...v.input,
    });
    const tag = `${c.name}-${v.name}`;
    const dir = join(outDir, tag);
    mkdirSync(dir, { recursive: true });
    const { paper, orientation, markers } = mat.meta;
    const label = `${tag} (${paper} ${orientation}, ${markers[0]!.widthMm} mm markers)`;
    const add = (image: string, file: string, r: Raster, mm: [number, number]) => {
      writeFileSync(join(dir, file), encodePng(r));
      const size = `${mm[0].toFixed(0)}×${mm[1].toFixed(0)} mm`;
      rows.push({
        mat: label,
        image,
        px: `${r.width}×${r.height}`,
        mm: size,
        file: join(dir, file),
      });
    };

    writeFileSync(join(dir, 'mat.svg'), mat.svg);
    for (const m of mat.markerPngs) {
      const w = markers.find((s) => s.id === m.id)!.widthMm;
      add(m.id, `marker-${m.id}.png`, decodePng(m.png), [w, w]);
    }
    const page = decodePng(mat.trackPng);
    add('mat', 'page.png', page, mat.layout.sizeMm);
    const pxPerMm = page.width / mat.layout.sizeMm[0];
    for (const [edge, r] of bands(mat.layout)) {
      const sx = Math.round(r.x * pxPerMm);
      const sy = Math.round(r.y * pxPerMm);
      const sw = Math.round((r.x + r.w) * pxPerMm) - sx;
      const sh = Math.round((r.y + r.h) * pxPerMm) - sy;
      // upscaled like the browser would (createImageBitmap resize) to ARCore's minimum size
      const k = Math.max(1, MIN_IMAGE_PX / Math.min(sw, sh));
      const crop = resizeBilinear(
        cropRaster(page, sx, sy, sw, sh),
        Math.round(sw * k),
        Math.round(sh * k),
      );
      add(`band-${edge}`, `band-${edge}.png`, crop, [r.w, r.h]);
    }
  }
}

let last = '';
for (const r of rows) {
  if (r.mat !== last) {
    console.log(`\n${r.mat}`);
    last = r.mat;
  }
  const s = arcoreimg ? score(arcoreimg, r.file) : '';
  console.log(`  ${r.image.padEnd(12)} ${r.px.padEnd(10)} ${r.mm.padEnd(12)} ${s}`);
}
console.log(`\nimages: ${outDir}`);
if (!arcoreimg) console.log('(set ARCOREIMG=/path/to/arcoreimg to score them)');

// ---------------------------------------------------------------------------

/**
 * Page-mm strips spanning the two markers along each page edge (plus their
 * quiet zones): the densest crops a mat without texture has to offer.
 */
function bands(l: MatLayout): [string, Rect][] {
  const out: [string, Rect][] = [];
  const [W, H] = l.sizeMm;
  const ms = l.markers;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const [a, b] = [ms[i]!, ms[j]!];
      const row = Math.abs(a.center[1] - b.center[1]) < 1;
      const col = Math.abs(a.center[0] - b.center[0]) < 1;
      if (row === col) continue;
      const edge = row
        ? a.center[1] < H / 2
          ? 'top'
          : 'bottom'
        : a.center[0] < W / 2
          ? 'left'
          : 'right';
      const half = (m: typeof a) => m.widthMm / 2 + MARKER_QUIET_MM;
      const x0 = Math.max(0, Math.min(a.center[0] - half(a), b.center[0] - half(b)));
      const y0 = Math.max(0, Math.min(a.center[1] - half(a), b.center[1] - half(b)));
      const x1 = Math.min(W, Math.max(a.center[0] + half(a), b.center[0] + half(b)));
      const y1 = Math.min(H, Math.max(a.center[1] + half(a), b.center[1] + half(b)));
      out.push([edge, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }]);
    }
  }
  return out;
}

/** arcoreimg's 0–100 score, or FAIL when it finds too few keypoints at all. */
function score(bin: string, file: string): string {
  try {
    const out = execFileSync(bin, ['eval-img', `--input_image_path=${file}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim().split('\n').pop() ?? '?';
  } catch {
    return 'FAIL';
  }
}

/** Decode the 8-bit grayscale, unfiltered PNGs that `encodePng` writes. */
function decodePng(png: Uint8Array): Raster {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  for (let o = 8; o < png.length;) {
    const len = v.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = v.getUint32(o + 8);
      height = v.getUint32(o + 12);
      if (data[8] !== 8 || data[9] !== 0) throw new Error('expected 8-bit grayscale');
    } else if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const joined = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
  let at = 0;
  for (const d of idat) {
    joined.set(d, at);
    at += d.length;
  }
  const raw = unzlibSync(joined);
  const r = createRaster(width, height);
  for (let y = 0; y < height; y++) {
    if (raw[y * (width + 1)] !== 0) throw new Error('expected unfiltered rows');
    r.data.set(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)), y * width);
  }
  return r;
}

function cropRaster(r: Raster, sx: number, sy: number, sw: number, sh: number): Raster {
  const out = createRaster(sw, sh);
  for (let y = 0; y < sh; y++) {
    const from = (sy + y) * r.width + sx;
    out.data.set(r.data.subarray(from, from + sw), y * sw);
  }
  return out;
}

function resizeBilinear(r: Raster, w: number, h: number): Raster {
  if (w === r.width && h === r.height) return r;
  const out = createRaster(w, h);
  const at = (x: number, y: number) => r.data[y * r.width + x]!;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(r.height - 1, Math.max(0, ((y + 0.5) * r.height) / h - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(r.height - 1, y0 + 1);
    for (let x = 0; x < w; x++) {
      const fx = Math.min(r.width - 1, Math.max(0, ((x + 0.5) * r.width) / w - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(r.width - 1, x0 + 1);
      const top = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * (fx - x0);
      const bot = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * (fx - x0);
      out.data[y * w + x] = Math.round(top + (bot - top) * (fy - y0));
    }
  }
  return out;
}
