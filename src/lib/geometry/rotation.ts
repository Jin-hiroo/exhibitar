import type { Vec3Tuple } from './mesh';

/**
 * Quaternion helpers without three.js, so the Studio's Setup tab can use them
 * without loading three.js (it loads with the 3D tabs). Same math as three's
 * `Quaternion.setFromUnitVectors`, `setFromAxisAngle` and `multiply`.
 */

/** Quaternion as [x, y, z, w]. */
export type QuatTuple = [number, number, number, number];

/** Rotation that turns `normal` (outward, model coords) straight down, then yaws about Y for FRONT. */
export function restingRotation(normal: Vec3Tuple, frontYawDeg = 0): QuatTuple {
  const len = Math.hypot(...normal);
  const [nx, ny, nz] = normal.map((c) => c / len);
  // from `normal` to DOWN (0, −1, 0)
  const r = -ny + 1;
  const rest: QuatTuple =
    r < 1e-8 // pointing up: turn 180° about a horizontal axis
      ? Math.abs(nx) > Math.abs(nz)
        ? [-ny, nx, 0, 0]
        : [0, -nz, ny, 0]
      : [nz, 0, -nx, r]; // [cross(normal, DOWN), 1 + dot(normal, DOWN)]
  const half = (frontYawDeg * Math.PI) / 360;
  return multiply([0, Math.sin(half), 0, Math.cos(half)], normalize(rest));
}

function normalize(q: QuatTuple): QuatTuple {
  const l = Math.hypot(...q);
  return l === 0 ? [0, 0, 0, 1] : (q.map((c) => c / l) as QuatTuple);
}

/** a × b: rotate by b, then by a */
function multiply([ax, ay, az, aw]: QuatTuple, [bx, by, bz, bw]: QuatTuple): QuatTuple {
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
