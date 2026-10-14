import * as poly from '../geometry/polygons';
import type { Polygons } from '../geometry/polygons';
import type { Rect } from './display-list';
import { textWidthMm } from './display-list';
import {
  planTiles,
  PRINTER_MARGIN_MM,
  sheetCandidates,
  type Orientation,
  type PaperName,
  type PaperPreference,
  type TilePlan,
} from './paper';

/** Free space kept between the object's shadow and anything printed. */
export const SHADOW_CLEARANCE_MM = 8;
/** White border kept around each marker. */
export const MARKER_QUIET_MM = 4;
export const DEFAULT_MARKER_WIDTH_MM = 60;
/**
 * Bigger markers tried on the chosen sheet, largest first, capped at a third
 * of the sheet's short side. ARCore only starts tracking an image that fills
 * about a quarter of the camera frame, so a bigger marker locks on from further away.
 */
const BIG_MARKER_WIDTHS_MM = [100, 90, 80, 70];
const MAX_MARKER_FRACTION = 0.33;
const ELEMENT_GAP_MM = 3;
const SEARCH_STEP_MM = 2.5;

export const QR_SIZE_MM = 24;
export const QR_BOX: [number, number] = [QR_SIZE_MM, QR_SIZE_MM + 6]; // + caption
export const RULER_BOX: [number, number] = [100, 14];
export const FRONT_BOX: [number, number] = [30, 18];
export const TITLE_SIZE_MM = 6;
export const SUBTITLE = 'Place the printed object on the outline. FRONT faces the visitor.';
export const SUBTITLE_SIZE_MM = 3;

export interface LayoutInput {
  /** mat XZ, mm, origin = contact bbox centre */
  shadowOutlineMm: Polygons;
  title: string;
  markerWidthMm?: number;
  paperPreference?: PaperPreference;
}

export interface MarkerSlot {
  /** page mm */
  center: [number, number];
  widthMm: number;
  /** clockwise on the page */
  rotationDeg: number;
}

export interface MatLayout {
  paper: PaperName;
  orientation: Orientation;
  tiles: { cols: number; rows: number };
  /** full mat (page) size, mm */
  sizeMm: [number, number];
  /** page position of the mat-frame origin: page = mat XZ + origin */
  originMm: [number, number];
  /** the shadow outline in page mm, grown by the clearance: nothing may be printed here */
  keepOut: Polygons;
  markers: MarkerSlot[];
  front: Rect;
  ruler: Rect;
  qr: Rect;
  /** omitted when there is no room */
  title?: { rect: Rect; sizeMm: number };
  /** present when the mat spans several sheets */
  tilePlan?: TilePlan;
}

/**
 * Place markers, QR, ruler, FRONT arrow and title around the object's shadow.
 * Tries single sheets smallest-first (with the default marker size, then as
 * big markers as fit on that sheet); falls back to a custom-size mat tiled
 * over several sheets.
 */
export function layoutMat(input: LayoutInput): MatLayout {
  const markerW = input.markerWidthMm ?? DEFAULT_MARKER_WIDTH_MM;
  const pref = input.paperPreference ?? 'iso';
  const sb = poly.bounds(input.shadowOutlineMm);
  const aspect = (sb.maxX - sb.minX) / Math.max(1e-6, sb.maxY - sb.minY);

  for (const s of sheetCandidates(pref, aspect)) {
    const l = tryLayout(input, s.sizeMm, PRINTER_MARGIN_MM, markerW);
    if (!l) continue;
    const best = input.markerWidthMm === undefined ? (biggerMarkers(input, s.sizeMm, l) ?? l) : l;
    return {
      ...best,
      paper: s.paper,
      orientation: s.orientation,
      tiles: { cols: 1, rows: 1 },
    };
  }

  // Custom mat: shadow + clearance + a ring of markers, with room for the elements.
  const ring = SHADOW_CLEARANCE_MM + markerW + 2 * MARKER_QUIET_MM + ELEMENT_GAP_MM;
  const margin = 5;
  const size: [number, number] = [
    Math.ceil(sb.maxX - sb.minX + 2 * (ring + margin)),
    Math.ceil(sb.maxY - sb.minY + 2 * (ring + margin)),
  ];
  // grow until everything fits (long elements may need a wider band)
  for (let grow = 0; grow < 400; grow += 20) {
    const sz: [number, number] = [size[0] + grow, size[1] + grow];
    const l = tryLayout(input, sz, margin, markerW);
    if (l) {
      const avoid = [
        ...l.markers.map((m) => {
          const half = m.widthMm / 2 + MARKER_QUIET_MM;
          return {
            x: m.center[0] - half,
            y: m.center[1] - half,
            w: 2 * half,
            h: 2 * half,
            weight: 10,
          };
        }),
        { ...l.qr, weight: 1 },
      ];
      const plan = planTiles(sz, pref, avoid);
      return {
        ...l,
        paper: plan.paper,
        orientation: plan.orientation,
        tiles: { cols: plan.cols, rows: plan.rows },
        tilePlan: plan,
      };
    }
  }
  throw new Error('Could not lay out the mat');
}

type Placed = Omit<MatLayout, 'paper' | 'orientation' | 'tiles' | 'tilePlan'>;

/**
 * The same sheet laid out with the largest marker width that still fits,
 * keeping what the default layout placed: all its markers, and the title at
 * the same size in the same row (not pushed down beside the object).
 */
function biggerMarkers(input: LayoutInput, size: [number, number], base: Placed): Placed | null {
  const cap = Math.floor(MAX_MARKER_FRACTION * Math.min(...size));
  const widths = [...new Set(BIG_MARKER_WIDTHS_MM.map((w) => Math.min(w, cap)))].filter(
    (w) => w > base.markers[0]!.widthMm,
  );
  const keepsTitle = (t: Placed['title']) =>
    !base.title ||
    (!!t && t.sizeMm === base.title.sizeMm && Math.abs(t.rect.y - base.title.rect.y) < 1);
  for (const w of widths) {
    const l = tryLayout(input, size, PRINTER_MARGIN_MM, w);
    if (l && l.markers.length >= base.markers.length && keepsTitle(l.title)) return l;
  }
  return null;
}

function tryLayout(
  input: LayoutInput,
  [W, H]: [number, number],
  margin: number,
  markerW: number,
): Placed | null {
  const sb = poly.bounds(input.shadowOutlineMm);
  const origin: [number, number] = [
    W / 2 - (sb.minX + sb.maxX) / 2,
    H / 2 - (sb.minY + sb.maxY) / 2,
  ];
  const shadowPage = input.shadowOutlineMm.map((r) =>
    r.map(([x, y]) => [x + origin[0], y + origin[1]] as [number, number]),
  );
  const keepOut = poly.offset(shadowPage, SHADOW_CLEARANCE_MM, 'round');
  const content: Rect = { x: margin, y: margin, w: W - 2 * margin, h: H - 2 * margin };
  if (!inside(poly.bounds(keepOut), content)) return null;

  const placed: Rect[] = [];
  const free = (r: Rect) =>
    inside(boundsOf(r), content) &&
    !placed.some((p) => overlaps(r, p, ELEMENT_GAP_MM)) &&
    !hitsPolygons(r, keepOut);

  // Markers: as close to the four corners as possible (wide spread = stable pose).
  const s = markerW + 2 * MARKER_QUIET_MM;
  const corners: [number, number][] = [
    [content.x, content.y],
    [content.x + content.w - s, content.y],
    [content.x, content.y + content.h - s],
    [content.x + content.w - s, content.y + content.h - s],
  ];
  const markers: MarkerSlot[] = [];
  for (const [cx, cy] of corners) {
    const r = search(content, [s, s], [cx + s / 2, cy + s / 2], free, s * 1.2);
    if (!r) continue;
    placed.push(r);
    markers.push({ center: [r.x + s / 2, r.y + s / 2], widthMm: markerW, rotationDeg: 0 });
  }
  if (markers.length < 3) return null;

  const shadowBottom = sb.maxY + origin[1];
  const frontFree = (r: Rect) => free(r) && r.y >= shadowBottom; // arrow sits on the FRONT side
  const front = search(
    content,
    FRONT_BOX,
    [W / 2, content.y + content.h - FRONT_BOX[1] / 2],
    frontFree,
  );
  if (!front) return null;
  placed.push(front);

  let title: MatLayout['title'];
  for (const size of [TITLE_SIZE_MM, 4.5]) {
    const tw = Math.max(
      textWidthMm(input.title, size, true),
      textWidthMm(SUBTITLE, SUBTITLE_SIZE_MM),
    );
    const th = size + SUBTITLE_SIZE_MM + 3;
    const r = search(content, [tw, th], [W / 2, content.y + th / 2], free);
    if (r) {
      placed.push(r);
      title = { rect: r, sizeMm: size };
      break;
    }
  }

  const qr = search(
    content,
    QR_BOX,
    [content.x + content.w - s - QR_BOX[0], content.y + QR_BOX[1] / 2],
    free,
  );
  if (!qr) return null;
  placed.push(qr);

  const ruler = search(
    content,
    RULER_BOX,
    [content.x + s + RULER_BOX[0] / 2, content.y + content.h - RULER_BOX[1] / 2],
    free,
  );
  if (!ruler) return null;
  placed.push(ruler);

  return { sizeMm: [W, H], originMm: origin, keepOut, markers, front, ruler, qr, title };
}

/**
 * Candidate positions on a grid inside `area`, nearest to `prefer` (centre)
 * first; returns the first rect accepted by `ok`.
 */
function search(
  area: Rect,
  [w, h]: [number, number],
  prefer: [number, number],
  ok: (r: Rect) => boolean,
  maxDistance = Infinity,
): Rect | null {
  const cands: { r: Rect; d: number }[] = [];
  for (let y = area.y; y + h <= area.y + area.h + 1e-9; y += SEARCH_STEP_MM) {
    for (let x = area.x; x + w <= area.x + area.w + 1e-9; x += SEARCH_STEP_MM) {
      const d = Math.hypot(x + w / 2 - prefer[0], y + h / 2 - prefer[1]);
      if (d <= maxDistance) cands.push({ r: { x, y, w, h }, d });
    }
  }
  // also try the exact preferred spot (the grid may not hit it)
  const exact = { x: prefer[0] - w / 2, y: prefer[1] - h / 2, w, h };
  cands.push({ r: exact, d: 0 });
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands) if (ok(c.r)) return c.r;
  return null;
}

function boundsOf(r: Rect) {
  return { minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h };
}

function inside(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  area: Rect,
): boolean {
  const e = 1e-6;
  return (
    b.minX >= area.x - e &&
    b.minY >= area.y - e &&
    b.maxX <= area.x + area.w + e &&
    b.maxY <= area.y + area.h + e
  );
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  );
}

function hitsPolygons(r: Rect, polys: Polygons): boolean {
  const pb = poly.bounds(polys);
  if (r.x > pb.maxX || r.x + r.w < pb.minX || r.y > pb.maxY || r.y + r.h < pb.minY) return false;
  return poly.area(poly.intersect([poly.rect(r.x, r.y, r.x + r.w, r.y + r.h)], polys)) > 0.01;
}
