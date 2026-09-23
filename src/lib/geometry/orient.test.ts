import { describe, expect, it } from 'vitest';
import { cube, lBlock, sphereOnFlat, toBinaryStl, tripod } from '../../../tests/fixtures/shapes';
import { computeBounds, type IndexedMesh, type Vec3Tuple } from './mesh';
import { applyOrientation, findRestingCandidates, restingRotation } from './orient';
import { parseStl } from './parse-stl';

const load = (t: Float32Array): IndexedMesh => parseStl(toBinaryStl(t)).mesh;
const near = (a: Vec3Tuple, b: Vec3Tuple, eps = 1e-3) =>
  Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps;

describe('findRestingCandidates', () => {
  it('prefers the as-printed face of a cube (all faces tie otherwise)', () => {
    const [best, ...rest] = findRestingCandidates(load(cube()));
    expect(best!.asPrinted).toBe(true);
    expect(near(best!.normal, [0, 0, -1])).toBe(true);
    expect(best!.contactAreaMm2).toBeCloseTo(3600, 0);
    expect(best!.marginMm).toBeCloseTo(30, 3);
    expect(rest).toHaveLength(5);
  });

  it('picks the largest real flat face of the L-block, not the as-printed one', () => {
    const cands = findRestingCandidates(load(lBlock()));
    const best = cands[0]!;
    expect(near(best.normal, [0, -1, 0])).toBe(true);
    expect(best.contactAreaMm2).toBeCloseTo(4000, 0);
    expect(best.stable).toBe(true);
    const asPrinted = cands.find((c) => c.asPrinted)!;
    expect(asPrinted.contactAreaMm2).toBeCloseTo(3200, 0); // the L itself, not its hull
    expect(asPrinted.hullAreaMm2).toBeCloseTo(5600, 0);
  });

  it('flags a pose where the centre of mass is outside the support face', () => {
    const cands = findRestingCandidates(load(lBlock()));
    const end = cands.find((c) => near(c.normal, [1, 0, 0]))!;
    // resting on the x = 100 end: support y ∈ [0, 20], centre of mass at y = 25
    expect(end.stable).toBe(false);
    expect(end.marginMm).toBeCloseTo(-5, 3);
  });

  it('finds the tripod feet plane with 3 small contacts', () => {
    const cands = findRestingCandidates(load(tripod()));
    const feet = cands.find((c) => near(c.normal, [0, 0, -1]))!;
    expect(feet.contactAreaMm2).toBeCloseTo(3 * 36, 0);
    expect(feet.stable).toBe(true);
    expect(feet.hullAreaMm2).toBeGreaterThan(3 * 36);
  });

  it('rests the sphere-on-flat on its flat cap', () => {
    const best = findRestingCandidates(load(sphereOnFlat()))[0]!;
    expect(near(best.normal, [0, 0, -1])).toBe(true);
    expect(best.contactAreaMm2).toBeGreaterThan(690);
    expect(best.contactAreaMm2).toBeLessThan(710);
  });
});

describe('applyOrientation', () => {
  it('maps an as-printed cube onto the mat: y from 0, footprint centred', () => {
    const mesh = load(cube());
    const { oriented, objectToMat, objectToMatMm } = applyOrientation(
      mesh,
      restingRotation([0, 0, -1]),
    );
    const b = computeBounds(oriented.positions);
    expect(b.min[1]).toBeCloseTo(0, 4);
    expect(b.max[1]).toBeCloseTo(60, 4);
    expect(b.min[0]).toBeCloseTo(-30, 4);
    expect(b.max[2]).toBeCloseTo(30, 4);
    // STL −Y (front of the printer) ends up at mat +Z (FRONT)
    expect(objectToMatMm[6]).toBeCloseTo(-1, 6); // model +Y → mat −Z
    expect(objectToMat.slice(0, 12)).toEqual(objectToMatMm.slice(0, 12));
    expect(objectToMat[13]).toBeCloseTo(objectToMatMm[13]! / 1000, 9);
  });

  it('centres the contact (not the whole object) and drops to y = 0', () => {
    const mesh = load(lBlock());
    const best = findRestingCandidates(mesh)[0]!;
    const { oriented } = applyOrientation(mesh, restingRotation(best.normal));
    const b = computeBounds(oriented.positions);
    expect(b.min[1]).toBeCloseTo(0, 4);
    // contact is the 100 × 40 face, so the footprint bbox is centred
    expect(b.min[0] + b.max[0]).toBeCloseTo(0, 3);
    expect(b.min[2] + b.max[2]).toBeCloseTo(0, 3);
    expect(b.size[1]).toBeCloseTo(80, 3);
  });

  it('applies the FRONT yaw about Y', () => {
    const mesh = load(lBlock());
    const a = applyOrientation(mesh, restingRotation([0, -1, 0], 0));
    const b = applyOrientation(mesh, restingRotation([0, -1, 0], 90));
    const ba = computeBounds(a.oriented.positions).size;
    const bb = computeBounds(b.oriented.positions).size;
    expect(bb[0]).toBeCloseTo(ba[2], 3);
    expect(bb[2]).toBeCloseTo(ba[0], 3);
  });
});
