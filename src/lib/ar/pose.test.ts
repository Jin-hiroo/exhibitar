import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { matFromModel } from './pose';

describe('matFromModel', () => {
  const identity = new Matrix4().elements.slice();

  it('applies calibration nudges in millimetres', () => {
    const m = matFromModel({ dxMm: 10, dyMm: 0, dzMm: -5, yawDeg: 0 }, identity);
    const p = new Vector3().setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(0.01, 9);
    expect(p.z).toBeCloseTo(-0.005, 9);
  });

  it('yaws about the mat origin, counter-clockwise seen from above', () => {
    const m = matFromModel({ dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 90 }, identity);
    const p = new Vector3(0.1, 0, 0).applyMatrix4(m);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(-0.1, 9);
  });

  it('chains calibration ∘ objectToMat', () => {
    const objectToMat = new Matrix4().makeRotationX(-Math.PI / 2).elements.slice(); // Z-up STL → Y-up
    const m = matFromModel({ dxMm: 0, dyMm: 5, dzMm: 0, yawDeg: 0 }, objectToMat);
    const top = new Vector3(0, 0, 0.06).applyMatrix4(m); // top of a 60 mm cube in model coords
    expect(top.distanceTo(new Vector3(0, 0.065, 0))).toBeLessThan(1e-9);
  });
});
