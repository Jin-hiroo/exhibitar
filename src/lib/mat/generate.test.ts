import { describe, expect, it } from 'vitest';
import { cube, toBinaryStl } from '../../../tests/fixtures/shapes';
import { computeFootprint } from '../geometry/footprint';
import { applyOrientation, restingRotation } from '../geometry/orient';
import { parseStl } from '../geometry/parse-stl';
import * as poly from '../geometry/polygons';
import { generateMat, markerSeedFor, type MatInput } from './generate';

async function cubeInput(): Promise<MatInput> {
  const mesh = parseStl(toBinaryStl(cube())).mesh;
  const fp = await computeFootprint(applyOrientation(mesh, restingRotation([0, 0, -1])).oriented);
  return {
    projectId: 'abc123',
    geometryVersion: 1,
    title: 'Test cube',
    siteUrl: 'https://exhibitar.vercel.app',
    contactOutlineMm: fp.contactOutlineMm,
    shadowOutlineMm: fp.shadowOutlineMm,
    contactWeak: fp.contactWeak,
  };
}

const svgSize = (svg: string) => {
  const m = svg.match(/<svg[^>]*width="([\d.]+)mm" height="([\d.]+)mm" viewBox="([^"]+)"/);
  return m ? { w: Number(m[1]), h: Number(m[2]), viewBox: m[3]!.split(' ').map(Number) } : null;
};

const pdfText = (pdf: Uint8Array) => new TextDecoder('latin1').decode(pdf);
const mediaBoxes = (pdf: Uint8Array) =>
  [...pdfText(pdf).matchAll(/\/MediaBox \[([\d. ]+)\]/g)].map((m) =>
    m[1]!.trim().split(/\s+/).map(Number),
  );

describe('generateMat', () => {
  it('produces an actual-size SVG matching the computed mat size', async () => {
    const mat = generateMat(await cubeInput());
    const s = svgSize(mat.svg)!;
    expect([s.w, s.h]).toEqual(mat.meta.sizeMm);
    expect(s.viewBox).toEqual([0, 0, ...mat.meta.sizeMm]);
    expect(mat.meta.sizeMm).toEqual([297, 210]);
    expect(mat.svg).toContain('Print at 100% / Actual size');
    expect(mat.svg).toContain('FRONT');
    expect(mat.tileSvgs).toEqual([]);
  });

  it('writes a one-page PDF at exactly the mat size', async () => {
    const mat = generateMat(await cubeInput());
    expect(pdfText(mat.pdf).startsWith('%PDF-')).toBe(true);
    const boxes = mediaBoxes(mat.pdf);
    expect(boxes).toHaveLength(1);
    const [, , w, h] = boxes[0]!;
    expect(w).toBeCloseTo((297 * 72) / 25.4, 1);
    expect(h).toBeCloseTo((210 * 72) / 25.4, 1);
  });

  it('is deterministic for the same project + geometry version', async () => {
    const input = await cubeInput();
    const a = generateMat(input);
    const b = generateMat(input);
    expect(a.svg).toBe(b.svg);
    expect(a.meta).toEqual(b.meta);
    a.markerPngs.forEach((m, i) =>
      expect(Buffer.from(m.png).equals(Buffer.from(b.markerPngs[i]!.png))).toBe(true),
    );
    // a new geometry version gets different markers
    const c = generateMat({ ...input, geometryVersion: 2 });
    expect(c.meta.markers.map((m) => m.seed)).not.toEqual(a.meta.markers.map((m) => m.seed));
    expect(markerSeedFor('abc123', 1)).toBe(markerSeedFor('abc123', 1));
  });

  it('reports marker poses in the mat frame, clear of the object', async () => {
    const mat = generateMat(await cubeInput());
    expect(mat.markerPngs.map((m) => m.id)).toEqual(mat.meta.markers.map((m) => m.id));
    for (const m of mat.meta.markers) {
      const half = m.widthMm / 2;
      const square = [
        poly.rect(
          m.centerMm[0] - half,
          m.centerMm[1] - half,
          m.centerMm[0] + half,
          m.centerMm[1] + half,
        ),
      ];
      expect(poly.area(poly.intersect(square, mat.meta.shadowOutlineMm))).toBe(0);
    }
    expect(mat.qrUrl).toBe('https://exhibitar.vercel.app/v/abc123');
    // the whole page as one tracking image, centred on the page
    expect(mat.meta.trackImage).toEqual({ widthMm: 297, heightMm: 210, centerMm: [0, 0] });
    const v = new DataView(mat.trackPng.buffer, mat.trackPng.byteOffset);
    expect([v.getUint32(16), v.getUint32(20)]).toEqual([1188, 840]);
    expect(mat.instructions).toMatch(/Actual size/);
  });

  it('tiles a huge mat: one SVG and one PDF page per sheet', () => {
    const shadow = [poly.rect(-200, -150, 200, 150)];
    const mat = generateMat({
      projectId: 'big',
      geometryVersion: 1,
      title: 'Huge',
      siteUrl: 'https://exhibitar.vercel.app',
      contactOutlineMm: shadow,
      shadowOutlineMm: shadow,
      contactWeak: false,
    });
    const sheets = mat.meta.tiles.cols * mat.meta.tiles.rows;
    expect(sheets).toBeGreaterThan(1);
    expect(mat.tileSvgs).toHaveLength(sheets);
    expect(mediaBoxes(mat.pdf)).toHaveLength(sheets);
    const s = svgSize(mat.tileSvgs[0]!.svg)!;
    expect([s.w, s.h]).toEqual(mat.layout.tilePlan!.sizeMm);
    expect(mat.instructions).toMatch(/Assembling/);
    // alignment crosshairs stay on the mat
    const [W, H] = mat.meta.sizeMm;
    const marks = [...mat.svg.matchAll(/<path d="([^"]+)"[^>]*stroke="#777"/g)].flatMap((m) =>
      [...m[1]!.matchAll(/([\d.]+) ([\d.]+)/g)].map((p) => [Number(p[1]), Number(p[2])]),
    );
    expect(marks.length).toBeGreaterThan(0);
    for (const [x, y] of marks) {
      expect(x).toBeLessThanOrEqual(W);
      expect(y).toBeLessThanOrEqual(H);
    }
  });
});
