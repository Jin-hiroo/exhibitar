import * as poly from '../geometry/polygons';
import { textWidthMm, type DrawItem, type Rect } from './display-list';
import { hitsPolygons, MARKER_QUIET_MM, type MatLayout } from './layout';
import { randomShape } from './markers';
import { mulberry32, range } from './prng';

/**
 * Black "confetti" printed over the mat's free space so the whole page is a
 * trackable image. ARCore rejects a reference image whose features are
 * bunched up with large blank areas in between (four corner markers on an
 * otherwise empty page), and the page is the only target big enough to be
 * found from a normal viewing distance.
 *
 * A jittered grid of random shapes: dense enough that every part of the page
 * has features, and big enough to still resolve when the whole page is only
 * ~300 px wide in the tracker's camera image. Tuned with `pnpm track-scores`.
 */

export interface TextureParams {
  /** grid pitch, mm: at most one shape per cell */
  cellMm: number;
  /** fraction of cells that get a shape */
  occupancy: number;
  /** nominal shape radius range, mm (`randomShape` extends to ~1.2×) */
  radiusMm: [number, number];
  /** where a full-size shape doesn't fit (next to an element), try it shrunk by these factors */
  shrink: number[];
  /** how far a shape's centre may wander from its cell centre, as a fraction of the cell */
  jitter: number;
  /** clearance around existing elements beyond their own bounds, mm */
  clearanceMm: {
    /** on top of the marker's quiet zone: marker images must stay exactly as printed */
    marker: number;
    /** the QR quiet zone */
    qr: number;
    /** text, ruler, FRONT arrow, tile marks */
    other: number;
  };
}

/**
 * Tuned with arcoreimg over many seeds (median page score ≈ 85–100 on the
 * A4 mock and an A3 skull mat). Smaller shapes vanish when the page is seen
 * small; a wider marker clearance leaves blank frames that cost more than
 * the shapes gain.
 */
export const TEXTURE: TextureParams = {
  cellMm: 18,
  occupancy: 0.85,
  radiusMm: [7, 13],
  shrink: [1, 0.6, 0.4],
  jitter: 0.3,
  clearanceMm: { marker: MARKER_QUIET_MM + 2, qr: 4, other: 2 },
};

/**
 * Texture shapes for a mat whose other `items` are already drawn: clear of
 * the placement area (`layout.keepOut`), every element and the page margin.
 * Deterministic for a given `seed`.
 */
export function textureItems(
  items: DrawItem[],
  layout: MatLayout,
  seed: number,
  p: TextureParams = TEXTURE,
): DrawItem[] {
  const rng = mulberry32(seed);
  const [W, H] = layout.sizeMm;
  const m = layout.marginMm;
  const obstacles = items.flatMap((it) => obstacleRect(it, p.clearanceMm));

  const cell = p.cellMm;
  const cols = Math.floor((W - 2 * m) / cell);
  const rows = Math.floor((H - 2 * m) / cell);
  // centre the grid on the page
  const x0 = (W - cols * cell) / 2;
  const y0 = (H - rows * cell) / 2;

  const fits = (ring: [number, number][]) => {
    const b = ringBounds(ring);
    if (b.x < m || b.y < m || b.x + b.w > W - m || b.y + b.h > H - m) return false;
    if (obstacles.some((o) => overlaps(b, o))) return false;
    // the bounding box touching the placement area is fine as long as the shape doesn't
    return !(
      hitsPolygons(b, layout.keepOut) && poly.area(poly.intersect([ring], layout.keepOut)) > 0.01
    );
  };

  const out: DrawItem[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // draw every random number first, so one rejected cell doesn't reshuffle the rest
      const occupied = rng() < p.occupancy;
      const cx = x0 + (col + 0.5 + range(rng, -p.jitter, p.jitter)) * cell;
      const cy = y0 + (row + 0.5 + range(rng, -p.jitter, p.jitter)) * cell;
      const shape = randomShape(rng, cx, cy, range(rng, p.radiusMm[0], p.radiusMm[1]));
      if (!occupied) continue;

      for (const k of p.shrink) {
        const ring = shape.map(([x, y]): [number, number] => [
          cx + (x - cx) * k,
          cy + (y - cy) * k,
        ]);
        if (!fits(ring)) continue;
        out.push({ kind: 'shape', role: 'texture', rings: [ring], closed: true, fill: '#000' });
        break;
      }
    }
  }
  return out;
}

/** An item's bounds grown by its clearance (none for the outlines: `keepOut` covers them). */
function obstacleRect(it: DrawItem, c: TextureParams['clearanceMm']): Rect[] {
  if (it.role === 'shadow' || it.role === 'contact' || it.role === 'texture') return [];
  const clear = it.role?.startsWith('marker:') ? c.marker : it.role === 'qr' ? c.qr : c.other;
  const b = it.kind === 'text' ? textBounds(it) : shapeBounds(it);
  return b ? [grow(b, clear)] : [];
}

/** Approximate ink box of a text item (same width estimate as the layout). */
export function textBounds(t: Extract<DrawItem, { kind: 'text' }>): Rect {
  const w = textWidthMm(t.text, t.sizeMm, t.bold);
  const x = t.anchor === 'start' ? t.x : t.anchor === 'middle' ? t.x - w / 2 : t.x - w;
  // ascent above the baseline, descenders below it
  return { x, y: t.y - t.sizeMm, w, h: 1.25 * t.sizeMm };
}

function shapeBounds(s: Extract<DrawItem, { kind: 'shape' }>): Rect | null {
  const pts = s.rings.flat();
  if (!pts.length) return null;
  const b = ringBounds(pts);
  return grow(b, (s.stroke?.widthMm ?? 0) / 2);
}

function ringBounds(pts: [number, number][]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const grow = (r: Rect, d: number): Rect => ({
  x: r.x - d,
  y: r.y - d,
  w: r.w + 2 * d,
  h: r.h + 2 * d,
});

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
