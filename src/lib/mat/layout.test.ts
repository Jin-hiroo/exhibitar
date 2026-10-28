import { jsPDF } from 'jspdf';
import { createBoard, pickTagIds } from 'matar';
import { describe, expect, it } from 'vitest';
import { cube, lBlock, sphereOnFlat, toBinaryStl, tripod } from '../../../tests/fixtures/shapes';
import { computeFootprint } from '../geometry/footprint';
import { applyOrientation, findRestingCandidates, restingRotation } from '../geometry/orient';
import { parseStl } from '../geometry/parse-stl';
import * as poly from '../geometry/polygons';
import type { Rect } from './display-list';
import {
  INNER_TAG_SIZE_MM,
  layoutMat,
  MAX_TAGS,
  SHADOW_CLEARANCE_MM,
  TAG_FAMILY,
  tagFootprint,
  type LayoutInput,
  type MatLayout,
} from './layout';
import { planTiles, PRINTER_MARGIN_MM, TILE_OVERLAP_MM, tileLabel } from './paper';

async function footprintOf(t: Float32Array, normal?: [number, number, number]) {
  const mesh = parseStl(toBinaryStl(t)).mesh;
  const n = normal ?? findRestingCandidates(mesh)[0]!.normal;
  return computeFootprint(applyOrientation(mesh, restingRotation(n)).oriented);
}

const IDS = pickTagIds(TAG_FAMILY, 2 * MAX_TAGS, 'layout-test');
const layout = (input: Omit<LayoutInput, 'tagIds'>) => layoutMat({ ...input, tagIds: IDS });
const tagRects = (l: MatLayout): Rect[] => l.tags.map((t) => tagFootprint(t, l.originMm));

/** True when `r` stays clear of every seam (overlap strip) of a tiled layout. */
function offSeams(l: MatLayout, r: Rect): boolean {
  return l.tilePlan!.windows.every(
    (win) =>
      (win.col === 0 || r.x + r.w <= win.x || r.x >= win.x + TILE_OVERLAP_MM) &&
      (win.row === 0 || r.y + r.h <= win.y || r.y >= win.y + TILE_OVERLAP_MM),
  );
}

const toPoly = (r: Rect) => [poly.rect(r.x, r.y, r.x + r.w, r.y + r.h)];
const shadowOnPage = (l: MatLayout, shadow: poly.Polygons) =>
  shadow.map((ring) =>
    ring.map(([x, y]) => [x + l.originMm[0], y + l.originMm[1]] as [number, number]),
  );

function assertValid(l: MatLayout, shadow: poly.Polygons) {
  const page = shadowOnPage(l, shadow);
  const clear = poly.offset(page, SHADOW_CLEARANCE_MM - 0.5);
  const elements = [l.qr, l.ruler, l.front, ...(l.title ? [l.title.rect] : [])];
  expect(l.tags.length).toBeGreaterThanOrEqual(12);
  expect(l.tags.length).toBeLessThanOrEqual(MAX_TAGS);
  // distinct IDs of the family, footprints (black square + white ring) apart: a valid matar board
  expect(() => createBoard({ family: TAG_FAMILY, tags: l.tags })).not.toThrow();
  for (const r of [...tagRects(l), ...elements]) {
    // never under (or too close to) the object's shadow
    expect(poly.area(poly.intersect(toPoly(r), clear))).toBeLessThan(1e-6);
    // on the paper
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(l.sizeMm[0]);
    expect(r.y + r.h).toBeLessThanOrEqual(l.sizeMm[1]);
  }
  // nothing printed over a tag's white ring
  for (const t of tagRects(l)) {
    for (const o of elements) expect(poly.area(poly.intersect(toPoly(t), toPoly(o)))).toBe(0);
  }
  // FRONT arrow is on the front (page-bottom) side of the object
  expect(l.front.y).toBeGreaterThanOrEqual(poly.bounds(page).maxY);
}

describe('layoutMat', () => {
  it('fits a 60 mm cube on one A4 sheet inside a ring of 16 tags', async () => {
    const fp = await footprintOf(cube());
    const l = layout({ shadowOutlineMm: fp.shadowOutlineMm, title: 'Cube' });
    expect(l.paper).toBe('A4');
    expect(l.tiles).toEqual({ cols: 1, rows: 1 });
    expect(l.tags).toHaveLength(16);
    expect(l.tags.every((t) => t.sizeMm === 32 && t.rotationDeg === 0)).toBe(true);
    expect(l.title).toBeDefined();
    assertValid(l, fp.shadowOutlineMm);
    // the ring hugs the printable edge, its tags in the mat frame (origin at the object's centre)
    const rects = tagRects(l);
    expect(Math.min(...rects.map((r) => r.x))).toBeCloseTo(PRINTER_MARGIN_MM, 6);
    expect(Math.min(...rects.map((r) => r.y))).toBeCloseTo(PRINTER_MARGIN_MM, 6);
  });

  it('adds a ring of small tags around a small object for close-ups', () => {
    // on A4 the title, QR, ruler and FRONT arrow leave room for it only around small objects
    const shadow = [poly.rect(-15, -15, 15, 15)];
    const l = layout({ shadowOutlineMm: shadow, title: 'Small' });
    expect(l.paper).toBe('A4');
    expect(l.innerTags).toBeGreaterThanOrEqual(4);
    const inner = l.tags.slice(-l.innerTags);
    expect(inner.every((t) => t.sizeMm === INNER_TAG_SIZE_MM)).toBe(true);
    // between the object and the outer ring
    for (const t of inner) expect(Math.hypot(...t.centerMm)).toBeLessThan(110);
    assertValid(l, shadow);
  });

  it('never puts tags or elements under the shadow for any fixture', async () => {
    for (const [t, n] of [
      [cube(), undefined],
      [lBlock(), undefined],
      [tripod(), [0, 0, -1]],
      [sphereOnFlat(), undefined],
    ] as const) {
      const fp = await footprintOf(t, n as [number, number, number] | undefined);
      const l = layout({ shadowOutlineMm: fp.shadowOutlineMm, title: 'Fixture' });
      assertValid(l, fp.shadowOutlineMm);
    }
  });

  it('picks a larger sheet for a larger object', () => {
    const shadow = [poly.rect(-80, -60, 80, 60)]; // 160 × 120 mm
    const l = layout({ shadowOutlineMm: shadow, title: 'Bigger' });
    expect(l.paper).toBe('A3');
    expect(l.tiles).toEqual({ cols: 1, rows: 1 });
    assertValid(l, shadow);
  });

  it('uses Letter/Tabloid for the US preference', () => {
    const l = layout({
      shadowOutlineMm: [poly.rect(-30, -30, 30, 30)],
      title: 'US',
      paperPreference: 'us',
    });
    expect(l.paper).toBe('Letter');
  });

  it('wraps the subtitle when one line is too wide for the space inside the ring', async () => {
    const fp = await footprintOf(cube());
    const l = layout({ shadowOutlineMm: fp.shadowOutlineMm, title: 'Cube' });
    expect(l.title!.subtitle.join(' ')).toBe(
      'Place the printed object on the outline. FRONT faces the visitor.',
    );
  });

  it('needs enough distinct tag IDs', () => {
    const shadow = [poly.rect(-30, -30, 30, 30)];
    expect(() =>
      layoutMat({ shadowOutlineMm: shadow, title: 'x', tagIds: IDS.slice(0, 10) }),
    ).toThrow();
    expect(() =>
      layoutMat({ shadowOutlineMm: shadow, title: 'x', tagIds: [...IDS.slice(0, 50), IDS[0]!] }),
    ).toThrow();
  });

  it('tiles an oversized mat over several sheets', () => {
    const shadow = [poly.rect(-200, -150, 200, 150)]; // 400 × 300 mm object
    const l = layout({ shadowOutlineMm: shadow, title: 'Huge' });
    expect(l.tilePlan).toBeDefined();
    expect(l.tiles.cols * l.tiles.rows).toBeGreaterThan(1);
    expect(l.sizeMm[0]).toBeGreaterThan(400);
    assertValid(l, shadow);
    // windows cover the whole mat
    const plan = l.tilePlan!;
    const first = plan.windows[0]!;
    const last = plan.windows[plan.windows.length - 1]!;
    expect(first.x).toBeLessThanOrEqual(0);
    expect(first.y).toBeLessThanOrEqual(0);
    expect(last.x + last.w).toBeGreaterThanOrEqual(l.sizeMm[0]);
    expect(last.y + last.h).toBeGreaterThanOrEqual(l.sizeMm[1]);
    // no seam (overlap strip) runs through a tag, the QR code or the ruler
    for (const r of [...tagRects(l), l.qr, l.ruler]) expect(offSeams(l, r)).toBe(true);
  });

  it('keeps the QR code and the ruler off the seams of a square tiled mat', () => {
    // review case: a 400 × 400 mm object put the QR code across the x = 390–400 mm strip
    const shadow = [poly.rect(-200, -200, 200, 200)];
    const l = layout({ shadowOutlineMm: shadow, title: 'Huge' });
    expect(l.tilePlan).toBeDefined();
    assertValid(l, shadow);
    expect(offSeams(l, l.qr)).toBe(true);
    expect(offSeams(l, l.ruler)).toBe(true);
  });

  it('reserves the printed width of a title of wide capitals', async () => {
    // review case: 25 × 'W' printed 141 mm wide where 90 mm was reserved
    const fp = await footprintOf(cube());
    const doc = new jsPDF({ unit: 'mm' });
    doc.setFont('helvetica', 'bold');
    for (const title of ['W'.repeat(25), 'TYRANNOSAURUS SKULL CAST']) {
      const l = layout({ shadowOutlineMm: fp.shadowOutlineMm, title });
      assertValid(l, fp.shadowOutlineMm);
      if (!l.title) continue; // no room: printed without a title
      expect(l.title.rect.w).toBeGreaterThanOrEqual(
        doc.getStringUnitWidth(title) * l.title.sizeMm - 1e-9,
      );
    }
  });
});

describe('planTiles', () => {
  it('shifts the sheet grid so seams avoid keep-out areas', () => {
    // a 500 mm-wide mat on A4: an unshifted seam would cut this box
    const plain = planTiles([500, 300], 'iso');
    const seam = plain.windows.find((w) => w.col === 1)!.x;
    const box = { x: seam - 20, y: 100, w: 60, h: 60, weight: 10 };
    const shifted = planTiles([500, 300], 'iso', [box]);
    for (const w of shifted.windows.filter((w) => w.col > 0)) {
      expect(box.x + box.w <= w.x || box.x >= w.x + TILE_OVERLAP_MM).toBe(true);
    }
  });

  it('uses one sheet when the mat fits and labels tiles A1, B1, …', () => {
    expect(planTiles([150, 200], 'iso')).toMatchObject({ paper: 'A4', cols: 1, rows: 1 });
    const p = planTiles([500, 300], 'iso');
    expect(p.windows).toHaveLength(p.cols * p.rows);
    expect(tileLabel(1, 0)).toBe('B1');
    // neighbours overlap
    if (p.cols > 1) expect(p.windows[1]!.x).toBeLessThan(p.windows[0]!.w);
  });
});
