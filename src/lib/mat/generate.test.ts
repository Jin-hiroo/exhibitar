import { describe, expect, it } from 'vitest';
import { cube, toBinaryStl } from '../../../tests/fixtures/shapes';
import { computeFootprint } from '../geometry/footprint';
import { applyOrientation, restingRotation } from '../geometry/orient';
import { parseStl } from '../geometry/parse-stl';
import * as poly from '../geometry/polygons';
import { boardTagCornersMm, createBoard, createDetector } from 'matar';
import { generateMat, tagSeedFor, type MatInput } from './generate';
import { buildMatDrawing } from './drawing';
import { tagFootprint } from './layout';
import { rasterizeDrawing } from './raster-drawing';
import { tagBlackRects } from './tag-cells';

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
    expect(mat.meta.sizeMm).toEqual([210, 297]);
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
    expect(w).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(h).toBeCloseTo((297 * 72) / 25.4, 1);
  });

  it('is deterministic for the same project + geometry version', async () => {
    const input = await cubeInput();
    const a = generateMat(input);
    const b = generateMat(input);
    expect(a.svg).toBe(b.svg);
    expect(a.meta).toEqual(b.meta);
    // a new geometry version gets other tag IDs in the same places
    const c = generateMat({ ...input, geometryVersion: 2 });
    expect(c.meta.tags.map((t) => t.centerMm)).toEqual(a.meta.tags.map((t) => t.centerMm));
    expect(c.meta.tags.map((t) => t.id)).not.toEqual(a.meta.tags.map((t) => t.id));
    expect(tagSeedFor('abc123', 1)).toBe('abc123:1');
  });

  it('reports the tags in the mat frame, clear of the object, as a valid matar board', async () => {
    const mat = generateMat(await cubeInput());
    expect(mat.meta.tagFamily).toBe('tag36h11');
    expect(() => createBoard({ family: mat.meta.tagFamily, tags: mat.meta.tags })).not.toThrow();
    for (const t of mat.meta.tags) {
      const r = tagFootprint(t, [0, 0]); // mat XZ
      const square = [poly.rect(r.x, r.y, r.x + r.w, r.y + r.h)];
      expect(poly.area(poly.intersect(square, mat.meta.shadowOutlineMm))).toBe(0);
    }
    // the SVG draws each tag's black cells where the meta says, in page mm (mat XZ + origin)
    const [ox, oy] = mat.layout.originMm;
    for (const t of mat.meta.tags) {
      const [x0, y0] = tagBlackRects(mat.meta.tagFamily, t.id, t.sizeMm)[0]!;
      const corner = `M${+(t.centerMm[0] + ox + x0).toFixed(2)} ${+(t.centerMm[1] + oy + y0).toFixed(2)}`;
      expect(mat.svg).toContain(corner);
    }
    expect(mat.qrUrl).toBe('https://exhibitar.vercel.app/v/abc123');
    // recorded with the project, so the Studio can tell when the printed QR no longer matches
    expect(mat.meta.qrUrl).toBe(mat.qrUrl);
    expect(mat.meta).not.toHaveProperty('markers');
    expect(mat.meta).not.toHaveProperty('trackImage');
    expect(mat.instructions).toMatch(/Actual size/);
  });

  it('prints tags matar finds where the mat data says they are', async () => {
    const input = await cubeInput();
    const mat = generateMat(input);
    const items = buildMatDrawing({
      layout: mat.layout,
      contactOutlineMm: input.contactOutlineMm,
      shadowOutlineMm: input.shadowOutlineMm,
      contactWeak: input.contactWeak,
      title: input.title,
      qrText: mat.qrUrl,
    });
    const pxPerMm = 3;
    const [W, H] = mat.meta.sizeMm;
    const img = rasterizeDrawing(items, { x: 0, y: 0, w: W, h: H }, pxPerMm);
    const ids = mat.meta.tags.map((t) => t.id);
    const found = createDetector({
      width: img.width,
      height: img.height,
      family: mat.meta.tagFamily,
      ids,
    }).detect(img);
    expect(found.map((f) => f.id).sort()).toEqual([...ids].sort());
    const [ox, oy] = mat.layout.originMm;
    for (const f of found) {
      const tag = mat.meta.tags.find((t) => t.id === f.id)!;
      // mat XZ → page mm → px (pixel centres at integers)
      boardTagCornersMm(tag).forEach(([x, z], i) => {
        const [u, v] = f.corners[i]!;
        expect(
          Math.hypot(u - ((x + ox) * pxPerMm - 0.5), v - ((z + oy) * pxPerMm - 0.5)),
        ).toBeLessThan(0.75);
      });
    }
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
