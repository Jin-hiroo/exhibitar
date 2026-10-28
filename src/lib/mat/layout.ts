import { DEFAULT_FAMILY, getFamily, layoutBorderTags, type BoardTag, type RectMm } from 'matar';
import * as poly from '../geometry/polygons';
import type { Polygons } from '../geometry/polygons';
import type { Rect } from './display-list';
import { textWidthMm } from './display-list';
import {
  planTiles,
  PRINTER_MARGIN_MM,
  TILE_OVERLAP_MM,
  sheetCandidates,
  type Orientation,
  type PaperName,
  type PaperPreference,
  type TilePlan,
} from './paper';

/** Free space kept between the object's shadow and anything printed. */
export const SHADOW_CLEARANCE_MM = 8;
/** matar tag family printed on the mat (AprilTag 36h11), stored as `mat.tagFamily`. */
export const TAG_FAMILY = DEFAULT_FAMILY;
/**
 * Black-square edge of the outer ring's tags, mm, smallest first. A mat whose
 * ring would hold more than MAX_OUTER_TAGS takes the next size up.
 */
const OUTER_TAG_SIZES_MM = [32, 40, 48, 56, 64];
/** Black-square edge of the inner ring around the object, for close-ups, mm. */
export const INNER_TAG_SIZE_MM = 20;
/** With fewer outer tags than this, the object has taken too much of the ring. */
const MIN_OUTER_TAGS = 12;
const MAX_OUTER_TAGS = 32;
/** An inner ring with fewer tags than this isn't printed. */
const MIN_INNER_TAGS = 4;
/** Both rings together, at most. */
export const MAX_TAGS = 40;
const ELEMENT_GAP_MM = 3;
const SEARCH_STEP_MM = 2.5;

export const QR_SIZE_MM = 24;
export const QR_BOX: [number, number] = [QR_SIZE_MM, QR_SIZE_MM + 6]; // + caption
export const RULER_BOX: [number, number] = [100, 14];
export const FRONT_BOX: [number, number] = [30, 18];
export const TITLE_SIZE_MM = 6;
export const SUBTITLE = 'Place the printed object on the outline. FRONT faces the visitor.';
/** `SUBTITLE` on two lines, where one is too wide for the space inside the ring */
const SUBTITLE_LINES = ['Place the printed object on the outline.', 'FRONT faces the visitor.'];
export const SUBTITLE_SIZE_MM = 3;
/** gap between the title's baseline and the subtitle's top, and between subtitle lines, mm */
export const SUBTITLE_GAP_MM = 2;

export interface LayoutInput {
  /** mat XZ, mm, origin = contact bbox centre */
  shadowOutlineMm: Polygons;
  title: string;
  /**
   * Tag IDs of `TAG_FAMILY` in the order the rings take them (outer ring
   * first): at least MAX_TAGS, distinct (`pickTagIds`).
   */
  tagIds: readonly number[];
  paperPreference?: PaperPreference;
}

export interface MatLayout {
  paper: PaperName;
  orientation: Orientation;
  tiles: { cols: number; rows: number };
  /** full mat (page) size, mm */
  sizeMm: [number, number];
  /** page position of the mat-frame origin: page = mat XZ + origin */
  originMm: [number, number];
  /** nothing is printed closer than this to the mat's edge */
  marginMm: number;
  /** the shadow outline in page mm, grown by the clearance: nothing may be printed here */
  keepOut: Polygons;
  /**
   * The tags to print, in mat XZ (matar's board frame: page = centre + origin):
   * the outer ring, then the inner ring if there is one.
   */
  tags: BoardTag[];
  /** how many of `tags` belong to the inner ring (the last ones) */
  innerTags: number;
  front: Rect;
  ruler: Rect;
  qr: Rect;
  /** omitted when there is no room */
  title?: { rect: Rect; sizeMm: number; subtitle: string[] };
  /** present when the mat spans several sheets */
  tilePlan?: TilePlan;
}

/**
 * Place the tag rings, QR, ruler, FRONT arrow and title around the object's
 * shadow. matar's `layoutBorderTags` fills the border band of the mat with
 * the outer ring and, where it fits, the band around the object with a ring of
 * smaller tags for close-ups; positions under the object are dropped. Tries
 * single sheets smallest-first; falls back to a custom-size mat tiled over
 * several sheets.
 */
export function layoutMat(input: LayoutInput): MatLayout {
  if (new Set(input.tagIds).size !== input.tagIds.length || input.tagIds.length < MAX_TAGS) {
    throw new Error(`layoutMat: needs at least ${MAX_TAGS} distinct tag IDs`);
  }
  const pref = input.paperPreference ?? 'iso';
  const sb = poly.bounds(input.shadowOutlineMm);
  const aspect = (sb.maxX - sb.minX) / Math.max(1e-6, sb.maxY - sb.minY);

  for (const s of sheetCandidates(pref, aspect)) {
    const l = tryLayout(input, s.sizeMm, PRINTER_MARGIN_MM);
    if (!l) continue;
    return { ...l, paper: s.paper, orientation: s.orientation, tiles: { cols: 1, rows: 1 } };
  }

  // Custom mat: shadow + clearance + the ring band, with room for the elements.
  const ring = SHADOW_CLEARANCE_MM + footprintMm(OUTER_TAG_SIZES_MM[0]!) + ELEMENT_GAP_MM;
  const margin = 5;
  const size: [number, number] = [
    Math.ceil(sb.maxX - sb.minX + 2 * (ring + margin)),
    Math.ceil(sb.maxY - sb.minY + 2 * (ring + margin)),
  ];
  // grow until everything fits (long elements may need a wider band)
  for (let grow = 0; grow < 400; grow += 20) {
    const sz: [number, number] = [size[0] + grow, size[1] + grow];
    // Sheets first: a ring along every edge can't keep all its tags off the
    // seams, so tags whose footprint would straddle one are dropped instead
    // (a tag split over two sheets reads as wrongly as the sheets are aligned).
    const plan = planTiles(sz, pref);
    const l = tryLayout(input, sz, margin, seamStrips(plan, sz));
    if (l) {
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

/** Edge of a tag's footprint (black square + 1-cell white ring), mm. */
export function footprintMm(sizeMm: number, family: string = TAG_FAMILY): number {
  const n = getFamily(family).squareCells;
  return (sizeMm * (n + 2)) / n;
}

/** A tag's footprint on the page (axis-aligned bounds, whatever its rotation), mm. */
export function tagFootprint(
  tag: BoardTag,
  originMm: [number, number],
  family: string = TAG_FAMILY,
): Rect {
  const a = (tag.rotationDeg * Math.PI) / 180;
  const half =
    (footprintMm(tag.sizeMm, family) / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
  const cx = tag.centerMm[0] + originMm[0];
  const cy = tag.centerMm[1] + originMm[1];
  return { x: cx - half, y: cy - half, w: 2 * half, h: 2 * half };
}

type Placed = Omit<MatLayout, 'paper' | 'orientation' | 'tiles' | 'tilePlan'>;

/** The overlap strips of a tiled mat, across the whole mat, page mm. */
function seamStrips(plan: TilePlan, [W, H]: [number, number]): RectMm[] {
  const strips: RectMm[] = [];
  for (const win of plan.windows) {
    if (win.row === 0 && win.col > 0) {
      strips.push({ x: win.x, y: 0, width: TILE_OVERLAP_MM, height: H });
    }
    if (win.col === 0 && win.row > 0) {
      strips.push({ x: 0, y: win.y, width: W, height: TILE_OVERLAP_MM });
    }
  }
  return strips;
}

function tryLayout(
  input: LayoutInput,
  [W, H]: [number, number],
  margin: number,
  seams: RectMm[] = [],
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
  const kb = poly.bounds(keepOut);
  if (!inside(kb, content)) return null;
  const objectRect: RectMm = {
    x: kb.minX,
    y: kb.minY,
    width: kb.maxX - kb.minX,
    height: kb.maxY - kb.minY,
  };

  for (const sizeMm of OUTER_TAG_SIZES_MM) {
    const outer = layoutBorderTags({
      areaMm: { x: 0, y: 0, width: W, height: H },
      originMm: origin,
      sizeMm,
      marginMm: margin,
      keepOutMm: [objectRect, ...seams],
      ids: input.tagIds,
      family: TAG_FAMILY,
    });
    if (outer.length > MAX_OUTER_TAGS) continue;
    if (outer.length < MIN_OUTER_TAGS) return null;
    const inner = innerRing(input, origin, objectRect, content, outer, seams);
    for (const tags of inner.length ? [[...outer, ...inner], outer] : [outer]) {
      const l = placeElements(input, [W, H], margin, origin, keepOut, tags, seams);
      if (l) return { ...l, innerTags: tags.length - outer.length };
    }
    return null;
  }
  return null;
}

/**
 * The ring of INNER_TAG_SIZE_MM tags hugging the object's keep-out: matar's
 * layout of the band around `objectRect`, without positions that would touch
 * an outer tag (one cell apart), straddle a seam or leave the printable area. Empty when fewer
 * than MIN_INNER_TAGS fit or both rings would exceed MAX_TAGS.
 */
function innerRing(
  input: LayoutInput,
  origin: [number, number],
  objectRect: RectMm,
  content: Rect,
  outer: BoardTag[],
  seams: RectMm[],
): BoardTag[] {
  const f = footprintMm(INNER_TAG_SIZE_MM);
  const cell = INNER_TAG_SIZE_MM / getFamily(TAG_FAMILY).squareCells;
  const keepOutMm: RectMm[] = outer.map((t) => {
    const r = tagFootprint(t, origin);
    return { x: r.x - cell, y: r.y - cell, width: r.w + 2 * cell, height: r.h + 2 * cell };
  });
  const tags = layoutBorderTags({
    areaMm: {
      x: objectRect.x - f,
      y: objectRect.y - f,
      width: objectRect.width + 2 * f,
      height: objectRect.height + 2 * f,
    },
    originMm: origin,
    sizeMm: INNER_TAG_SIZE_MM,
    marginMm: 0,
    keepOutMm: [...keepOutMm, ...seams],
    ids: input.tagIds.slice(outer.length),
    family: TAG_FAMILY,
  }).filter((t) => inside(boundsOf(tagFootprint(t, origin)), content));
  return tags.length >= MIN_INNER_TAGS && outer.length + tags.length <= MAX_TAGS ? tags : [];
}

/**
 * FRONT arrow, title, QR and ruler in the space the tags and the object leave
 * free. The QR code and the ruler also stay off tile seams: one split over two
 * sheets scans or measures only as well as the sheets are aligned.
 */
function placeElements(
  input: LayoutInput,
  [W, H]: [number, number],
  margin: number,
  origin: [number, number],
  keepOut: Polygons,
  tags: BoardTag[],
  seams: RectMm[] = [],
): Omit<Placed, 'innerTags'> | null {
  const content: Rect = { x: margin, y: margin, w: W - 2 * margin, h: H - 2 * margin };
  const placed: Rect[] = tags.map((t) => tagFootprint(t, origin));
  const free = (r: Rect) =>
    inside(boundsOf(r), content) &&
    !placed.some((p) => overlaps(r, p, ELEMENT_GAP_MM)) &&
    !hitsPolygons(r, keepOut);
  const seamRects: Rect[] = seams.map((s) => ({ x: s.x, y: s.y, w: s.width, h: s.height }));
  const freeOffSeams = (r: Rect) => free(r) && !seamRects.some((s) => overlaps(r, s, 0));
  // just inside the outer ring
  const band = margin + footprintMm(tags[0]!.sizeMm) + ELEMENT_GAP_MM;

  const shadowBottom = poly.bounds(keepOut).maxY - SHADOW_CLEARANCE_MM;
  const frontFree = (r: Rect) => free(r) && r.y >= shadowBottom; // arrow sits on the FRONT side
  const front = search(content, FRONT_BOX, [W / 2, H - band - FRONT_BOX[1] / 2], frontFree);
  if (!front) return null;
  placed.push(front);

  let title: MatLayout['title'];
  const tries = [TITLE_SIZE_MM, 4.5].flatMap((size) =>
    [[SUBTITLE], SUBTITLE_LINES].map((subtitle) => ({ size, subtitle })),
  );
  for (const { size, subtitle } of tries) {
    const tw = Math.max(
      textWidthMm(input.title, size, true),
      ...subtitle.map((line) => textWidthMm(line, SUBTITLE_SIZE_MM)),
    );
    const th = size + subtitle.length * (SUBTITLE_GAP_MM + SUBTITLE_SIZE_MM) + 1;
    const r = search(content, [tw, th], [W / 2, band + th / 2], free);
    if (r) {
      placed.push(r);
      title = { rect: r, sizeMm: size, subtitle };
      break;
    }
  }

  const qr = search(
    content,
    QR_BOX,
    [W - band - QR_BOX[0] / 2, band + QR_BOX[1] / 2],
    freeOffSeams,
  );
  if (!qr) return null;
  placed.push(qr);

  const ruler = search(
    content,
    RULER_BOX,
    [band + RULER_BOX[0] / 2, H - band - RULER_BOX[1] / 2],
    freeOffSeams,
  );
  if (!ruler) return null;
  placed.push(ruler);

  return {
    sizeMm: [W, H],
    originMm: origin,
    marginMm: margin,
    keepOut,
    tags,
    front,
    ruler,
    qr,
    title,
  };
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

/** True when rect `r` overlaps `polys` (more than a sliver). */
export function hitsPolygons(r: Rect, polys: Polygons): boolean {
  const pb = poly.bounds(polys);
  if (r.x > pb.maxX || r.x + r.w < pb.minX || r.y > pb.maxY || r.y + r.h < pb.minY) return false;
  return poly.area(poly.intersect([poly.rect(r.x, r.y, r.x + r.w, r.y + r.h)], polys)) > 0.01;
}
