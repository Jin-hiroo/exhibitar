import { describe, expect, it } from 'vitest';
import { cube, lBlock, sphereOnFlat, toBinaryStl, tripod } from '../../../tests/fixtures/shapes';
import { computeFootprint } from '../geometry/footprint';
import { applyOrientation, findRestingCandidates, restingRotation } from '../geometry/orient';
import { parseStl } from '../geometry/parse-stl';
import * as poly from '../geometry/polygons';
import type { Rect } from './display-list';
import {
  DEFAULT_MARKER_WIDTH_MM,
  layoutMat,
  MARKER_QUIET_MM,
  SHADOW_CLEARANCE_MM,
  type MatLayout,
} from './layout';
import { planTiles, PRINTER_MARGIN_MM, TILE_OVERLAP_MM, tileLabel } from './paper';

async function footprintOf(t: Float32Array, normal?: [number, number, number]) {
  const mesh = parseStl(toBinaryStl(t)).mesh;
  const n = normal ?? findRestingCandidates(mesh)[0]!.normal;
  return computeFootprint(applyOrientation(mesh, restingRotation(n)).oriented);
}

function markerRects(l: MatLayout): Rect[] {
  return l.markers.map((m) => ({
    x: m.center[0] - m.widthMm / 2,
    y: m.center[1] - m.widthMm / 2,
    w: m.widthMm,
    h: m.widthMm,
  }));
}

const toPoly = (r: Rect) => [poly.rect(r.x, r.y, r.x + r.w, r.y + r.h)];
const shadowOnPage = (l: MatLayout, shadow: poly.Polygons) =>
  shadow.map((ring) =>
    ring.map(([x, y]) => [x + l.originMm[0], y + l.originMm[1]] as [number, number]),
  );

function assertValid(l: MatLayout, shadow: poly.Polygons) {
  const page = shadowOnPage(l, shadow);
  const clear = poly.offset(page, SHADOW_CLEARANCE_MM - 0.5);
  const elements = [...markerRects(l), l.qr, l.ruler, l.front, ...(l.title ? [l.title.rect] : [])];
  expect(l.markers.length).toBeGreaterThanOrEqual(3);
  for (const r of elements) {
    // never under (or too close to) the object's shadow
    expect(poly.area(poly.intersect(toPoly(r), clear))).toBeLessThan(1e-6);
    // on the paper
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(l.sizeMm[0]);
    expect(r.y + r.h).toBeLessThanOrEqual(l.sizeMm[1]);
  }
  // markers keep their quiet zone from everything else
  const all = [...markerRects(l), l.qr, l.ruler, l.front, ...(l.title ? [l.title.rect] : [])];
  markerRects(l).forEach((m, i) => {
    const grown = { x: m.x - MARKER_QUIET_MM, y: m.y - MARKER_QUIET_MM, w: m.w + 8, h: m.h + 8 };
    all.forEach((o, j) => {
      if (i === j) return;
      expect(poly.area(poly.intersect(toPoly(grown), toPoly(o)))).toBeLessThan(1e-6);
    });
  });
  // FRONT arrow is on the front (page-bottom) side of the object
  expect(l.front.y).toBeGreaterThanOrEqual(poly.bounds(page).maxY);
}

describe('layoutMat', () => {
  it('fits a 60 mm cube on one A4 sheet with 4 corner markers', async () => {
    const fp = await footprintOf(cube());
    const l = layoutMat({ shadowOutlineMm: fp.shadowOutlineMm, title: 'Cube' });
    expect(l.paper).toBe('A4');
    expect(l.tiles).toEqual({ cols: 1, rows: 1 });
    expect(l.sizeMm).toEqual([297, 210]);
    expect(l.markers).toHaveLength(4);
    expect(l.title).toBeDefined();
    assertValid(l, fp.shadowOutlineMm);
    // markers hug the printable corners
    const xs = l.markers.map((m) => m.center[0]);
    const half = l.markers[0]!.widthMm / 2 + MARKER_QUIET_MM;
    expect(Math.min(...xs) - half).toBeCloseTo(PRINTER_MARGIN_MM, 0);
  });

  it('prints markers as large as the sheet allows, keeping the title on top', () => {
    const shadow = [poly.rect(-80, -60, 80, 60)]; // 160 × 120 mm → A3
    const l = layoutMat({ shadowOutlineMm: shadow, title: 'Bigger' });
    expect(l.paper).toBe('A3');
    const w = l.markers[0]!.widthMm;
    expect(w).toBeGreaterThan(DEFAULT_MARKER_WIDTH_MM);
    expect(w).toBeLessThanOrEqual(0.33 * Math.min(...l.sizeMm));
    expect(l.markers.every((m) => m.widthMm === w)).toBe(true);
    assertValid(l, shadow);
    // same title, same place as with the default markers
    const small = layoutMat({
      shadowOutlineMm: shadow,
      title: 'Bigger',
      markerWidthMm: DEFAULT_MARKER_WIDTH_MM,
    });
    expect(l.title?.sizeMm).toBe(small.title?.sizeMm);
    expect(l.title?.rect.y).toBeCloseTo(small.title!.rect.y, 3);
  });

  it('respects an explicit marker width', () => {
    const shadow = [poly.rect(-80, -60, 80, 60)];
    const l = layoutMat({ shadowOutlineMm: shadow, title: 'Fixed', markerWidthMm: 60 });
    expect(l.markers.map((m) => m.widthMm)).toEqual([60, 60, 60, 60]);
    assertValid(l, shadow);
  });

  it('never puts markers or elements under the shadow for any fixture', async () => {
    for (const [t, n] of [
      [cube(), undefined],
      [lBlock(), undefined],
      [tripod(), [0, 0, -1]],
      [sphereOnFlat(), undefined],
    ] as const) {
      const fp = await footprintOf(t, n as [number, number, number] | undefined);
      const l = layoutMat({ shadowOutlineMm: fp.shadowOutlineMm, title: 'Fixture' });
      assertValid(l, fp.shadowOutlineMm);
    }
  });

  it('picks a larger sheet for a larger object', () => {
    const shadow = [poly.rect(-80, -60, 80, 60)]; // 160 × 120 mm
    const l = layoutMat({ shadowOutlineMm: shadow, title: 'Bigger' });
    expect(l.paper).toBe('A3');
    expect(l.tiles).toEqual({ cols: 1, rows: 1 });
    assertValid(l, shadow);
  });

  it('uses Letter/Tabloid for the US preference', () => {
    const l = layoutMat({
      shadowOutlineMm: [poly.rect(-30, -30, 30, 30)],
      title: 'US',
      paperPreference: 'us',
    });
    expect(l.paper).toBe('Letter');
  });

  it('tiles an oversized mat over several sheets', () => {
    const shadow = [poly.rect(-200, -150, 200, 150)]; // 400 × 300 mm object
    const l = layoutMat({ shadowOutlineMm: shadow, title: 'Huge' });
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
    // no seam (overlap strip) runs through a marker
    for (const win of plan.windows) {
      for (const m of markerRects(l)) {
        if (win.col > 0) {
          expect(m.x + m.w <= win.x || m.x >= win.x + TILE_OVERLAP_MM).toBe(true);
        }
        if (win.row > 0) {
          expect(m.y + m.h <= win.y || m.y >= win.y + TILE_OVERLAP_MM).toBe(true);
        }
      }
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
