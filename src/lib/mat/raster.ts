/**
 * Minimal 8-bit grayscale rasterizer for filled polygons (painter's order).
 * Pure TypeScript so images (the QR PNG, test renders of the mat) are
 * identical in Node tests, workers and browsers.
 */
export interface Raster {
  width: number;
  height: number;
  /** row-major, 0 = black, 255 = white */
  data: Uint8Array;
}

export type Point = [number, number];

export function createRaster(width: number, height: number, fill = 255): Raster {
  return { width, height, data: new Uint8Array(width * height).fill(fill) };
}

/**
 * Fill a polygon (even-odd rule across its rings) with `value`, sampling at
 * pixel centres. Coordinates are in pixels.
 */
export function fillPolygon(r: Raster, rings: Point[][], value: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [, y] of ring) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(r.height - 1, Math.ceil(maxY));
  const xs: number[] = [];
  for (let py = y0; py <= y1; py++) {
    const yc = py + 0.5;
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i]!;
        const [bx, by] = ring[(i + 1) % ring.length]!;
        if ((ay <= yc && yc < by) || (by <= yc && yc < ay)) {
          xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
        }
      }
    }
    xs.sort((a, b) => a - b);
    const row = py * r.width;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]! - 0.5));
      const xb = Math.min(r.width - 1, Math.ceil(xs[k + 1]! - 0.5) - 1);
      for (let px = xa; px <= xb; px++) r.data[row + px] = value;
    }
  }
}

/** Box-filter downsample by an integer factor (anti-aliasing after supersampling). */
export function downsample(r: Raster, factor: number): Raster {
  const w = Math.floor(r.width / factor);
  const h = Math.floor(r.height / factor);
  const out = createRaster(w, h);
  const n = factor * factor;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * r.width + x * factor;
        for (let dx = 0; dx < factor; dx++) s += r.data[row + dx]!;
      }
      out.data[y * w + x] = Math.round(s / n);
    }
  }
  return out;
}
