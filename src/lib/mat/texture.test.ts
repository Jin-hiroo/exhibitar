import { describe, expect, it } from 'vitest';
import * as poly from '../geometry/polygons';
import type { DrawItem, Rect } from './display-list';
import { buildMatDrawing } from './drawing';
import { generateMat } from './generate';
import { hitsPolygons, layoutMat, MARKER_QUIET_MM, QR_SIZE_MM, type MatLayout } from './layout';
import { pickMarkers } from './markers';
import { rasterizeDrawing } from './raster-drawing';
import { TEXTURE, textBounds, textureItems } from './texture';

type Shape = Extract<DrawItem, { kind: 'shape' }>;

/** A 160 × 120 mm object: an A3 mat with room around it. */
const SHADOW = [poly.rect(-80, -60, 80, 60)];

function drawing(shadow: poly.Polygons, textureSeed?: number) {
  const layout = layoutMat({ shadowOutlineMm: shadow, title: 'Texture test' });
  const items = buildMatDrawing({
    layout,
    contactOutlineMm: shadow,
    shadowOutlineMm: shadow,
    contactWeak: false,
    markerArts: pickMarkers(7, layout.markers.length).map((m) => m.art),
    title: 'Texture test',
    qrText: 'https://exhibitar.vercel.app/v/abc123',
    textureSeed,
  });
  return { layout, items };
}

const texture = (items: DrawItem[]) => items.filter((i): i is Shape => i.role === 'texture');

function bounds(s: Shape): Rect {
  const pts = s.rings.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const grow = (r: Rect, d: number): Rect => ({
  x: r.x - d,
  y: r.y - d,
  w: r.w + 2 * d,
  h: r.h + 2 * d,
});
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('textureItems', () => {
  const { layout, items } = drawing(SHADOW, 1234);
  const shapes = texture(items);

  it('is deterministic per seed', () => {
    expect(texture(drawing(SHADOW, 1234).items)).toEqual(shapes);
    expect(texture(drawing(SHADOW, 1235).items)).not.toEqual(shapes);
    expect(texture(drawing(SHADOW).items)).toEqual([]);
  });

  it('fills an A3 mat with a meaningful number of black shapes, drawn last', () => {
    expect(layout.paper).toBe('A3');
    expect(shapes.length).toBeGreaterThan(50);
    expect(shapes.every((s) => s.fill === '#000' && s.closed)).toBe(true);
    const first = items.findIndex((i) => i.role === 'texture');
    expect(items.slice(first).every((i) => i.role === 'texture')).toBe(true);
  });

  it('keeps the placement area, page margin, markers, QR and text clear', () => {
    const [W, H] = layout.sizeMm;
    const m = layout.marginMm;
    const markers = layout.markers.map((s) =>
      grow(
        {
          x: s.center[0] - s.widthMm / 2,
          y: s.center[1] - s.widthMm / 2,
          w: s.widthMm,
          h: s.widthMm,
        },
        // the marker's own quiet zone stays white, plus the texture's clearance
        Math.max(MARKER_QUIET_MM, TEXTURE.clearanceMm.marker),
      ),
    );
    const qr = grow({ x: layout.qr.x, y: layout.qr.y, w: QR_SIZE_MM, h: QR_SIZE_MM }, 4);
    const texts = items.flatMap((i) => (i.kind === 'text' ? [textBounds(i)] : []));
    expect(texts.length).toBeGreaterThan(5); // title, captions, ruler, FRONT
    for (const s of shapes) {
      const b = bounds(s);
      expect(b.x).toBeGreaterThanOrEqual(m);
      expect(b.y).toBeGreaterThanOrEqual(m);
      expect(b.x + b.w).toBeLessThanOrEqual(W - m);
      expect(b.y + b.h).toBeLessThanOrEqual(H - m);
      expect(poly.area(poly.intersect(s.rings, layout.keepOut))).toBeLessThan(0.01);
      for (const r of [...markers, qr, ...texts]) expect(overlaps(b, r)).toBe(false);
    }
  });

  it('puts ink where the untextured tracking image was blank', () => {
    const plain = drawing(SHADOW).items;
    const view = { x: 0, y: 0, w: layout.sizeMm[0], h: layout.sizeMm[1] };
    const ppm = 2;
    const a = rasterizeDrawing(plain, view, ppm);
    const b = rasterizeDrawing(items, view, ppm);
    // 30 mm windows that were blank before and lie outside the placement area
    const win = 30;
    let blank = 0;
    let inked = 0;
    for (let y = layout.marginMm; y + win <= view.h - layout.marginMm; y += win) {
      for (let x = layout.marginMm; x + win <= view.w - layout.marginMm; x += win) {
        if (hitsPolygons({ x, y, w: win, h: win }, layout.keepOut)) continue;
        if (darkPixels(a, x, y, win, ppm) > 0) continue;
        blank++;
        if (darkPixels(b, x, y, win, ppm) > 0) inked++;
      }
    }
    expect(blank).toBeGreaterThan(5);
    expect(inked / blank).toBeGreaterThan(0.6);
  });

  it('is printed and tracked by default, and can be turned off', () => {
    const input = {
      projectId: 'abc123',
      geometryVersion: 1,
      title: 'T',
      siteUrl: 'https://exhibitar.vercel.app',
      contactOutlineMm: SHADOW,
      shadowOutlineMm: SHADOW,
      contactWeak: false,
    };
    const on = generateMat(input);
    const off = generateMat({ ...input, texture: false });
    const paths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    expect(paths(on.svg)).toBeGreaterThan(paths(off.svg) + 50);
    expect(Buffer.from(on.trackPng).equals(Buffer.from(off.trackPng))).toBe(false);
    // marker images and poses don't change
    expect(on.meta).toEqual(off.meta);
    on.markerPngs.forEach((m, i) =>
      expect(Buffer.from(m.png).equals(Buffer.from(off.markerPngs[i]!.png))).toBe(true),
    );
  });

  it('leaves a mat with no free space untextured rather than failing', () => {
    const l: MatLayout = { ...layout, keepOut: [poly.rect(0, 0, ...layout.sizeMm)] };
    expect(
      textureItems(
        items.filter((i) => i.role !== 'texture'),
        l,
        1,
      ),
    ).toEqual([]);
  });
});

function darkPixels(
  r: { width: number; data: Uint8Array },
  xMm: number,
  yMm: number,
  sizeMm: number,
  ppm: number,
): number {
  let n = 0;
  for (let y = Math.round(yMm * ppm); y < Math.round((yMm + sizeMm) * ppm); y++) {
    for (let x = Math.round(xMm * ppm); x < Math.round((xMm + sizeMm) * ppm); x++) {
      if (r.data[y * r.width + x]! < 128) n++;
    }
  }
  return n;
}
