import { downsample, type Raster } from './raster';

/**
 * Heuristic tracking-quality checks for marker images: enough well-spread
 * corners (feature points) and no rotational or mirror symmetry, so the
 * tracker can't confuse orientations.
 */
export interface MarkerQuality {
  ok: boolean;
  corners: number;
  /** fraction of 4×4 grid cells that contain at least one corner */
  coverage: number;
  /** min pixel difference against its own rotations/mirrors (0..1) */
  asymmetry: number;
}

export const MIN_CORNERS = 60;
export const MIN_COVERAGE = 0.75;
export const MIN_ASYMMETRY = 0.2;

export function assessMarker(r: Raster): MarkerQuality {
  const small = r.width > 256 ? downsample(r, Math.floor(r.width / 256)) : r;
  const pts = harrisCorners(small);
  const cells = new Set(
    pts.map(([x, y]) => Math.floor((4 * y) / small.height) * 4 + Math.floor((4 * x) / small.width)),
  );
  const coverage = cells.size / 16;
  const asymmetry = selfSimilarityGap(r);
  return {
    ok: pts.length >= MIN_CORNERS && coverage >= MIN_COVERAGE && asymmetry >= MIN_ASYMMETRY,
    corners: pts.length,
    coverage,
    asymmetry,
  };
}

/** Min fraction of differing pixels between `a` and `b` under the 4 rotations of `b`. */
export function distinctness(a: Raster, b: Raster): number {
  const A = binarize(toSize(a, 64));
  const B = binarize(toSize(b, 64));
  let best = 1;
  for (let rot = 0; rot < 4; rot++) best = Math.min(best, diff(A, transform(B, 64, rot, false)));
  return best;
}

// ---------------------------------------------------------------------------

function toSize(r: Raster, n: number): Raster {
  return r.width === n ? r : downsample(r, Math.floor(r.width / n));
}

function binarize(r: Raster): Uint8Array {
  return Uint8Array.from(r.data, (v) => (v < 128 ? 1 : 0));
}

function diff(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d / a.length;
}

/** Rotate by `rot` × 90° clockwise, optionally mirrored horizontally first. */
function transform(img: Uint8Array, n: number, rot: number, mirror: boolean): Uint8Array {
  const out = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let sx = mirror ? n - 1 - x : x;
      let sy = y;
      for (let k = 0; k < rot; k++) {
        const t = sx;
        sx = sy;
        sy = n - 1 - t;
      }
      out[y * n + x] = img[sy * n + sx]!;
    }
  }
  return out;
}

function selfSimilarityGap(r: Raster): number {
  const n = 64;
  const img = binarize(toSize(r, n));
  // ignore the frame, which is symmetric by design
  const inner = (a: Uint8Array) => {
    const m = Math.round(n * 0.1);
    const out: number[] = [];
    for (let y = m; y < n - m; y++) for (let x = m; x < n - m; x++) out.push(a[y * n + x]!);
    return Uint8Array.from(out);
  };
  const base = inner(img);
  let gap = 1;
  for (const mirror of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      if (!mirror && rot === 0) continue;
      gap = Math.min(gap, diff(base, inner(transform(img, n, rot, mirror))));
    }
  }
  return gap;
}

/** Harris corner detector with 5×5 non-maximum suppression. Returns [x, y] pixels. */
function harrisCorners(r: Raster): [number, number][] {
  const { width: w, height: h, data } = r;
  const ix = new Float32Array(w * h);
  const iy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (dx: number, dy: number) => data[(y + dy) * w + x + dx]! / 255;
      ix[y * w + x] = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      iy[y * w + x] = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
    }
  }
  const resp = new Float32Array(w * h);
  let max = 0;
  const R = 2;
  for (let y = R + 1; y < h - R - 1; y++) {
    for (let x = R + 1; x < w - R - 1; x++) {
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const i = (y + dy) * w + x + dx;
          sxx += ix[i]! * ix[i]!;
          syy += iy[i]! * iy[i]!;
          sxy += ix[i]! * iy[i]!;
        }
      }
      const v = sxx * syy - sxy * sxy - 0.05 * (sxx + syy) ** 2;
      resp[y * w + x] = v;
      if (v > max) max = v;
    }
  }
  const thr = max * 0.05;
  const out: [number, number][] = [];
  const N = 2;
  for (let y = N; y < h - N; y++) {
    for (let x = N; x < w - N; x++) {
      const v = resp[y * w + x]!;
      if (v <= thr) continue;
      let isMax = true;
      for (let dy = -N; dy <= N && isMax; dy++) {
        for (let dx = -N; dx <= N; dx++) {
          if ((dx || dy) && resp[(y + dy) * w + x + dx]! >= v) {
            isMax = false;
            break;
          }
        }
      }
      if (isMax) out.push([x, y]);
    }
  }
  return out;
}
