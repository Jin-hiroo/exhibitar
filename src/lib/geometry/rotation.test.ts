import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { restingRotation } from './rotation';
import type { Vec3Tuple } from './mesh';

/** the three.js version this module replaces */
function withThree(normal: Vec3Tuple, frontYawDeg: number): number[] {
  const rest = new Quaternion().setFromUnitVectors(
    new Vector3(...normal).normalize(),
    new Vector3(0, -1, 0),
  );
  const yaw = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    (frontYawDeg * Math.PI) / 180,
  );
  const q = yaw.multiply(rest);
  return [q.x, q.y, q.z, q.w];
}

describe('restingRotation', () => {
  const normals: Vec3Tuple[] = [
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [1, 0, 0],
    [0.3, 0.9, -0.2],
    [-2, 0.5, 4],
    [1e-9, 1, 0],
    [0, 1, 1e-9],
  ];

  it('matches three.js', () => {
    for (const n of normals) {
      for (const yaw of [0, 37, 90, 180, -135]) {
        const got = restingRotation(n, yaw);
        withThree(n, yaw).forEach((c, i) => expect(got[i]).toBeCloseTo(c, 12));
      }
    }
  });

  it('turns the normal straight down', () => {
    for (const n of normals) {
      const [x, y, z, w] = restingRotation(n, 25);
      const v = new Vector3(...n).normalize().applyQuaternion(new Quaternion(x, y, z, w));
      expect(v.y).toBeCloseTo(-1, 9);
    }
  });
});
