import { encodePng } from './png';
import { int, mulberry32, range, type Rng } from './prng';
import { assessMarker, distinctness, type MarkerQuality } from './quality';
import { createRaster, downsample, fillPolygon, type Point, type Raster } from './raster';

/**
 * Procedural tracking-marker art. Everything derives from one integer seed,
 * so the SVG on the printed mat and the PNG handed to the image tracker are
 * guaranteed to be the same picture.
 *
 * Coordinates are in the unit square, x right, y down (image convention).
 */
export interface MarkerShape {
  rings: Point[][];
  fill: 0 | 255;
}

export interface MarkerArt {
  seed: number;
  /** painted in order over a white square */
  shapes: MarkerShape[];
}

/** Marker PNG edge length, px. ARCore recommends ≥ 300 px. */
export const MARKER_PX = 512;
const SUPERSAMPLE = 2;
const BORDER = 0.07;

export function generateMarkerArt(seed: number): MarkerArt {
  const rng = mulberry32(seed);
  const shapes: MarkerShape[] = [];
  // thick black frame: a strong, high-contrast edge for detection
  shapes.push({ rings: [square(0, 0, 1, 1)], fill: 0 });
  shapes.push({ rings: [square(BORDER, BORDER, 1 - BORDER, 1 - BORDER)], fill: 255 });

  const lo = BORDER + 0.03;
  const hi = 1 - BORDER - 0.03;
  const add = (ring: Point[], fill: 0 | 255) =>
    shapes.push({ rings: [ring.map(([x, y]) => [clamp(x, lo, hi), clamp(y, lo, hi)])], fill });

  // a few large shapes: coarse features that stay visible from far away
  for (let i = int(rng, 2, 4); i > 0; i--) {
    add(randomShape(rng, range(rng, lo, hi), range(rng, lo, hi), range(rng, 0.12, 0.22)), 0);
  }
  // many small shapes stratified over a 4×4 grid: fine features everywhere
  const cell = (hi - lo) / 4;
  const cells = shuffle(
    rng,
    Array.from({ length: 32 }, (_, i) => i % 16),
  );
  for (const c of cells) {
    const cx = lo + ((c % 4) + rng()) * cell;
    const cy = lo + (Math.floor(c / 4) + rng()) * cell;
    add(randomShape(rng, cx, cy, range(rng, 0.03, 0.09)), rng() < 0.75 ? 0 : 255);
  }
  return { seed, shapes };
}

/** Rasterise marker art to a square grayscale image (anti-aliased). */
export function renderMarkerRaster(art: MarkerArt, px = MARKER_PX): Raster {
  const size = px * SUPERSAMPLE;
  const r = createRaster(size, size, 255);
  for (const s of art.shapes) {
    fillPolygon(
      r,
      s.rings.map((ring) => ring.map(([x, y]) => [x * size, y * size] as Point)),
      s.fill,
    );
  }
  return downsample(r, SUPERSAMPLE);
}

export interface Marker {
  art: MarkerArt;
  raster: Raster;
  png: Uint8Array;
  quality: MarkerQuality;
}

export function buildMarker(seed: number): Marker {
  const art = generateMarkerArt(seed);
  const raster = renderMarkerRaster(art);
  return { art, raster, png: encodePng(raster), quality: assessMarker(raster) };
}

/**
 * Starting at `baseSeed`, return the first `count` seeds whose markers pass
 * the quality check and are mutually distinct (in all 4 rotations).
 */
export function pickMarkers(baseSeed: number, count: number, maxTries = 200): Marker[] {
  const picked: Marker[] = [];
  for (let s = baseSeed >>> 0, tries = 0; picked.length < count; s = (s + 1) >>> 0, tries++) {
    if (tries >= maxTries) throw new Error(`could not find ${count} good markers`);
    const m = buildMarker(s);
    if (!m.quality.ok) continue;
    if (picked.some((p) => distinctness(p.raster, m.raster) < 0.2)) continue;
    picked.push(m);
  }
  return picked;
}

// ---------------------------------------------------------------------------

/**
 * A random triangle, bar or spiky star of nominal radius `r` around (cx, cy).
 * Scale-free: marker art uses unit-square coordinates, the mat texture millimetres.
 * Points stay within about 1.2 r of the centre.
 */
export function randomShape(rng: Rng, cx: number, cy: number, r: number): Point[] {
  const kind = rng();
  if (kind < 0.35) return triangle(rng, cx, cy, r);
  if (kind < 0.65)
    return rotatedRect(rng, cx, cy, r * range(rng, 0.8, 2), r * range(rng, 0.3, 0.8));
  return spikyStar(rng, cx, cy, r);
}

function shuffle<T>(rng: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function square(x0: number, y0: number, x1: number, y1: number): Point[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

function triangle(rng: Rng, cx: number, cy: number, r: number): Point[] {
  const a0 = range(rng, 0, Math.PI * 2);
  return [0, 1, 2].map((k) => {
    const a = a0 + (k * 2 * Math.PI) / 3 + range(rng, -0.5, 0.5);
    const rr = r * range(rng, 0.6, 1.2);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
}

function rotatedRect(rng: Rng, cx: number, cy: number, w: number, h: number): Point[] {
  const a = range(rng, 0, Math.PI);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as Point[]
  ).map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function spikyStar(rng: Rng, cx: number, cy: number, r: number): Point[] {
  const n = int(rng, 4, 7) * 2;
  const a0 = range(rng, 0, Math.PI * 2);
  const pts: Point[] = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (k * 2 * Math.PI) / n + range(rng, -0.15, 0.15);
    const rr = k % 2 === 0 ? r * range(rng, 0.8, 1.2) : r * range(rng, 0.3, 0.55);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
