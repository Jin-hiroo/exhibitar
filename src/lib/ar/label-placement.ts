import type { Vec3 } from '../types';
import { mmToM } from '../units';

/** How far a label floats off its anchor unless the annotation sets its own (`labelOffsetMm`). */
export const DEFAULT_LABEL_OFFSET_MM = 25;
/** The range an exhibitor can pick a label distance from (mm). */
export const MIN_LABEL_OFFSET_MM = 5;
export const MAX_LABEL_OFFSET_MM = 150;
/** The default label distance (metres). */
export const LABEL_OFFSET_M = mmToM(DEFAULT_LABEL_OFFSET_MM);
/** Around the leader line, this radius must be clear of the model in front of the label (metres). */
export const LABEL_CLEAR_RADIUS_M = 0.025;
/** Gap between the label and the furthest part of the model it has to clear (metres). */
export const LABEL_CLEARANCE_M = 0.01;
/** Escape directions never point into the surface (up along a side wall is fine). */
const MIN_NORMAL_DOT = -1e-6;
/** Hits closer than this to the anchor are its own surface, not something in the way (metres). */
const OWN_SURFACE_M = 1e-4;
/**
 * The blocked-line test starts this far off the surface (metres), so a line running
 * along a wall does not count the wall's own edges as something in the way.
 */
const LINE_LIFT_M = 5e-4;

/** Probe rays parallel to the leader line: the line itself plus two rings around it. */
const PROBES: readonly [number, number][] = [
  [0, 0],
  ...[1, 0.5].flatMap((r) =>
    Array.from({ length: 8 }, (_, k): [number, number] => {
      const a = (k * Math.PI) / 4;
      return [r * LABEL_CLEAR_RADIUS_M * Math.cos(a), r * LABEL_CLEAR_RADIUS_M * Math.sin(a)];
    }),
  ),
];

export interface PlacementMesh {
  /** xyz per vertex, model coords (metres) */
  positions: ArrayLike<number>;
  /** three vertex indices per triangle; null for a non-indexed mesh */
  index: ArrayLike<number> | null;
}

/** The mat's axes expressed in model coordinates. */
export interface MatAxes {
  /** mat +Y (away from the table) */
  up: Vec3;
  /** mat +Z (FRONT, towards the visitor) */
  front: Vec3;
}

interface Option {
  d: Vec3;
  /** distance from the anchor to the label */
  t: number;
  /** the leader line itself passes through the model */
  blocked: boolean;
}

/**
 * An annotation's label distance (mm): its own `labelOffsetMm`, else the default,
 * kept within the range the Studio offers (stored values are not trusted).
 */
export function labelOffsetMm(annotation: { labelOffsetMm?: number }): number {
  const mm = annotation.labelOffsetMm;
  if (typeof mm !== 'number' || !Number.isFinite(mm)) return DEFAULT_LABEL_OFFSET_MM;
  return Math.min(MAX_LABEL_OFFSET_MM, Math.max(MIN_LABEL_OFFSET_MM, mm));
}

/**
 * Label positions that are never buried in the model.
 *
 * A label sits `offset` (default `LABEL_OFFSET_M`) off its anchor along the surface
 * normal. When the model is in the way there (an anchor deep in an eye socket or a
 * pocket), the label moves further out, past everything within `LABEL_CLEAR_RADIUS_M`
 * of the leader line. It escapes along the normal, the horizontal outward direction,
 * the mat's FRONT, mat up, or a blend with the normal: preferring a leader line that
 * does not pass through the model, then the shortest one.
 *
 * All coordinates are model coords (metres).
 */
export function createLabelPlacer(
  mesh: PlacementMesh,
  axes: MatAxes,
): (anchor: Vec3, normal: Vec3, offset?: number) => Vec3 {
  const pos = mesh.positions;
  const vertexCount = Math.floor(pos.length / 3);
  const index = mesh.index;
  const triangleCount = Math.floor((index ? index.length : vertexCount) / 3);
  const u = normalize(axes.up) ?? ([0, 1, 0] as Vec3);
  const front = normalize(axes.front);
  const center = boundsCenter(pos, vertexCount);
  // vertex coordinates in the frame of the current probe direction: (x, y) across it, z along it
  const px = new Float32Array(vertexCount);
  const py = new Float32Array(vertexCount);
  const pz = new Float32Array(vertexCount);

  /** Where a label along `d` from `a` (normal `n`) has to go to clear the model, and whether the line is blocked. */
  const option = (a: Vec3, n: Vec3, d: Vec3, offset: number): Option => {
    const [e1, e2] = perpendicularBasis(d);
    // the leader line, lifted off the surface, in the probe frame
    const lx = LINE_LIFT_M * dot(n, e1);
    const ly = LINE_LIFT_M * dot(n, e2);
    const lz = LINE_LIFT_M * dot(n, d);
    for (let v = 0; v < vertexCount; v++) {
      const x = pos[v * 3]! - a[0];
      const y = pos[v * 3 + 1]! - a[1];
      const z = pos[v * 3 + 2]! - a[2];
      px[v] = x * e1[0] + y * e1[1] + z * e1[2];
      py[v] = x * e2[0] + y * e2[1] + z * e2[2];
      pz[v] = x * d[0] + y * d[1] + z * d[2];
    }
    const r = LABEL_CLEAR_RADIUS_M;
    let far = 0;
    let blocked = false;
    for (let t = 0; t < triangleCount; t++) {
      const i0 = index ? index[t * 3]! : t * 3;
      const i1 = index ? index[t * 3 + 1]! : t * 3 + 1;
      const i2 = index ? index[t * 3 + 2]! : t * 3 + 2;
      const z0 = pz[i0]!;
      const z1 = pz[i1]!;
      const z2 = pz[i2]!;
      const zMax = Math.max(z0, z1, z2);
      // nothing in front of the anchor, or nothing new to learn from this triangle
      if (zMax <= OWN_SURFACE_M || (blocked && zMax <= far)) continue;
      const x0 = px[i0]!;
      const x1 = px[i1]!;
      const x2 = px[i2]!;
      const y0 = py[i0]!;
      const y1 = py[i1]!;
      const y2 = py[i2]!;
      if (Math.min(x0, x1, x2) > r || Math.max(x0, x1, x2) < -r) continue;
      if (Math.min(y0, y1, y2) > r || Math.max(y0, y1, y2) < -r) continue;
      const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(det) < 1e-14) continue; // edge-on: parallel to the line, never in front of it
      for (const [ox, oy] of PROBES) {
        far = Math.max(far, crossing(ox, oy, x0, y0, z0, x1, y1, z1, x2, y2, z2, det));
      }
      if (!blocked) {
        blocked = crossing(lx, ly, x0, y0, z0, x1, y1, z1, x2, y2, z2, det) > lz + OWN_SURFACE_M;
      }
    }
    // `far` stays 0 when nothing is in front of the label
    return { d, t: Math.max(offset, far > 0 ? far + LABEL_CLEARANCE_M : 0), blocked };
  };

  const better = (a: Option, b: Option) => (a.blocked !== b.blocked ? !a.blocked : a.t < b.t);

  return (anchor, normal, offset = LABEL_OFFSET_M) => {
    const n = normalize(normal) ?? u;
    let best = option(anchor, n, n, offset);
    if (best.blocked || best.t > offset) {
      const fromCenter = sub(anchor, center);
      const outward = normalize(sub(fromCenter, scale(u, dot(fromCenter, u))));
      for (const e of [outward, front, u]) {
        if (!e) continue;
        for (const c of [add(n, e), e]) {
          const d = normalize(c);
          if (!d || dot(d, n) < MIN_NORMAL_DOT) continue;
          const o = option(anchor, n, d, offset);
          if (better(o, best)) best = o;
        }
      }
    }
    return add(anchor, scale(best.d, best.t));
  };
}

/**
 * How far along the line the ray through (ox, oy), parallel to it, crosses a triangle
 * projected into the probe frame (edges included), or -Infinity if it misses.
 */
function crossing(
  ox: number,
  oy: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  det: number,
): number {
  const w0 = ((y1 - y2) * (ox - x2) + (x2 - x1) * (oy - y2)) / det;
  const w1 = ((y2 - y0) * (ox - x2) + (x0 - x2) * (oy - y2)) / det;
  const w2 = 1 - w0 - w1;
  return w0 < 0 || w1 < 0 || w2 < 0 ? -Infinity : w0 * z0 + w1 * z1 + w2 * z2;
}

function boundsCenter(pos: ArrayLike<number>, count: number): Vec3 {
  if (count === 0) return [0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < count; v++) {
    for (let k = 0; k < 3; k++) {
      const c = pos[v * 3 + k]!;
      if (c < min[k]!) min[k] = c;
      if (c > max[k]!) max[k] = c;
    }
  }
  return [0, 1, 2].map((k) => (min[k]! + max[k]!) / 2) as Vec3;
}

/** Two unit vectors perpendicular to unit `d` and to each other. */
function perpendicularBasis(d: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = normalize(cross(d, helper))!;
  return [e1, cross(d, e1)];
}

function normalize(v: Vec3): Vec3 | null {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
