import { describe, expect, it } from 'vitest';
import { cube, lBlock, sphereOnFlat, toBinaryStl, tripod } from '../../../tests/fixtures/shapes';
import { computeFootprint } from './footprint';
import { applyOrientation, findRestingCandidates, restingRotation } from './orient';
import { parseStl } from './parse-stl';
import { bounds } from './polygons';

const orient = (t: Float32Array, normal?: [number, number, number]) => {
  const mesh = parseStl(toBinaryStl(t)).mesh;
  const n = normal ?? findRestingCandidates(mesh)[0]!.normal;
  return applyOrientation(mesh, restingRotation(n)).oriented;
};

/** The shadow is grown slightly (conservative), never shrunk. */
const expectShadowNear = (actual: number, exact: number) => {
  expect(actual).toBeGreaterThanOrEqual(exact);
  expect(actual).toBeLessThan(exact * 1.01);
};

describe('computeFootprint', () => {
  it('cube → contact and shadow are the 60 mm square', async () => {
    const fp = await computeFootprint(orient(cube()));
    expect(fp.contactOutlineMm).toHaveLength(1);
    expect(fp.contactAreaMm2).toBeCloseTo(3600, 0);
    expectShadowNear(fp.shadowAreaMm2, 3600);
    const b = bounds(fp.contactOutlineMm);
    expect(b.minX).toBeCloseTo(-30, 2);
    expect(b.maxX).toBeCloseTo(30, 2);
    expect(b.minY).toBeCloseTo(-30, 2);
    expect(b.maxY).toBeCloseTo(30, 2);
    expect(fp.contactWeak).toBe(false);
  });

  it('tripod on its feet → 3 contact islands, weak contact, plate-sized shadow', async () => {
    const fp = await computeFootprint(orient(tripod(), [0, 0, -1]));
    expect(fp.contactIslands).toBe(3);
    expect(fp.contactAreaMm2).toBeCloseTo(3 * 36, 0);
    expectShadowNear(fp.shadowAreaMm2, 3600);
    expect(fp.contactWeak).toBe(true);
  });

  it('sphere-on-flat → one disc of radius 15, round shadow of radius 30', async () => {
    const fp = await computeFootprint(orient(sphereOnFlat()));
    expect(fp.contactIslands).toBe(1);
    expect(fp.contactAreaMm2).toBeGreaterThan(695);
    expect(fp.contactAreaMm2).toBeLessThan(710);
    expectShadowNear(fp.shadowAreaMm2, 2814); // 48-gon of radius 30
    const b = bounds(fp.shadowOutlineMm);
    expect(b.maxX - b.minX).toBeCloseTo(60, 0);
  });

  it('L-block on its long face → 100 × 40 contact and shadow', async () => {
    const fp = await computeFootprint(orient(lBlock()));
    expect(fp.contactAreaMm2).toBeCloseTo(4000, 0);
    expectShadowNear(fp.shadowAreaMm2, 4000);
  });

  it('shadow of a dense mesh never under-estimates the silhouette', async () => {
    const fp = await computeFootprint(orient(sphereOnFlat({ segments: 300, rings: 150 })));
    const b = bounds(fp.shadowOutlineMm);
    expect(b.maxX).toBeGreaterThanOrEqual(29.99);
    expect(b.minX).toBeLessThanOrEqual(-29.99);
  });
});
