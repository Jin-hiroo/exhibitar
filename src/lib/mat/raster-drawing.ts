import type { DrawItem } from './display-list';
import { createRaster, downsample, fillPolygon, type Point, type Raster } from './raster';

export interface RasterView {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SUPERSAMPLE = 2;

/**
 * Rasterise display-list shapes (fills and strokes, including dashes) to an
 * 8-bit grayscale image of `view` at `pxPerMm`. Text is skipped: this image is
 * a tracking reference, and the print having *extra* features is harmless,
 * while every feature in the reference must exist on the print.
 */
export function rasterizeDrawing(items: DrawItem[], view: RasterView, pxPerMm: number): Raster {
  const s = pxPerMm * SUPERSAMPLE;
  const w = Math.round(view.w * s);
  const h = Math.round(view.h * s);
  const r = createRaster(w, h, 255);
  const toPx = ([x, y]: [number, number]): Point => [(x - view.x) * s, (y - view.y) * s];

  for (const it of items) {
    if (it.kind !== 'shape') continue;
    if (it.fill && it.closed) {
      // fillPolygon is even-odd across rings; for non-evenOdd items fill rings one by one
      const rings = it.rings.map((ring) => ring.map(toPx));
      if (it.evenOdd) fillPolygon(r, rings, gray(it.fill));
      else for (const ring of rings) fillPolygon(r, [ring], gray(it.fill));
    }
    if (it.stroke) {
      const width = Math.max(1, it.stroke.widthMm * s);
      const value = gray(it.stroke.color);
      for (const ring of it.rings) {
        const pts = ring.map(toPx);
        if (it.closed && pts.length > 2) pts.push(pts[0]!);
        for (const [a, b] of dashedSegments(
          pts,
          (it.stroke.dashMm ?? []).map((d) => d * s),
        )) {
          fillPolygon(r, [segmentQuad(a, b, width)], value);
        }
      }
    }
  }
  return downsample(r, SUPERSAMPLE);
}

/** '#rgb' / '#rrggbb' → luminance 0..255 */
export function gray(color: string): number {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return 0;
  const rr = (n >> 16) & 255;
  const gg = (n >> 8) & 255;
  const bb = n & 255;
  return Math.round(0.2126 * rr + 0.7152 * gg + 0.0722 * bb);
}

/** Split a polyline into the "on" pieces of a dash pattern (solid if the pattern is empty). */
function dashedSegments(pts: Point[], dash: number[]): [Point, Point][] {
  const out: [Point, Point][] = [];
  if (dash.length === 0 || dash.every((d) => d <= 0)) {
    for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i]!, pts[i + 1]!]);
    return out;
  }
  let di = 0;
  let left = dash[0]!;
  let on = true;
  for (let i = 0; i + 1 < pts.length; i++) {
    let [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    let segLen = Math.hypot(bx - ax, by - ay);
    while (segLen > 1e-9) {
      const step = Math.min(left, segLen);
      const t = step / segLen;
      const nx = ax + (bx - ax) * t;
      const ny = ay + (by - ay) * t;
      if (on)
        out.push([
          [ax, ay],
          [nx, ny],
        ]);
      ax = nx;
      ay = ny;
      segLen -= step;
      left -= step;
      if (left <= 1e-9) {
        di = (di + 1) % dash.length;
        left = dash[di]!;
        on = !on;
      }
    }
  }
  return out;
}

function segmentQuad([ax, ay]: Point, [bx, by]: Point, width: number): Point[] {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * (width / 2);
  const ny = ((bx - ax) / len) * (width / 2);
  // extend by half a width so joints close
  const ex = ((bx - ax) / len) * (width / 2);
  const ey = ((by - ay) / len) * (width / 2);
  return [
    [ax - ex + nx, ay - ey + ny],
    [bx + ex + nx, by + ey + ny],
    [bx + ex - nx, by + ey - ny],
    [ax - ex - nx, ay - ey - ny],
  ];
}
