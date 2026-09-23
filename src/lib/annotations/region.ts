import type { Vec3 } from '../types';

/**
 * Region painting on the stored (simplified) mesh. Regions are sets of
 * triangle indices into that exact GLB (CLAUDE.md core idea #3), so these
 * helpers take the decoded GLB's positions/indices in model coords (metres).
 */

/** Centroid (xyz) of every triangle. */
export function triangleCentroids(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
): Float32Array {
  const n = indices.length / 3;
  const out = new Float32Array(n * 3);
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k]! * 3;
      out[t * 3] = out[t * 3]! + positions[v]! / 3;
      out[t * 3 + 1] = out[t * 3 + 1]! + positions[v + 1]! / 3;
      out[t * 3 + 2] = out[t * 3 + 2]! + positions[v + 2]! / 3;
    }
  }
  return out;
}

/** Triangles whose centroid lies within `radius` of `center` (a brush dab). */
export function trianglesInSphere(centroids: Float32Array, center: Vec3, radius: number): number[] {
  const r2 = radius * radius;
  const out: number[] = [];
  for (let t = 0; t < centroids.length / 3; t++) {
    const dx = centroids[t * 3]! - center[0];
    const dy = centroids[t * 3 + 1]! - center[1];
    const dz = centroids[t * 3 + 2]! - center[2];
    if (dx * dx + dy * dy + dz * dz <= r2) out.push(t);
  }
  return out;
}

/** Per-triangle bounding spheres for brush queries (built once per mesh). */
export interface TriangleSpatial {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
  centroids: Float32Array;
  /** max distance from each centroid to its vertices */
  radii: Float32Array;
}

export function buildTriangleSpatial(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
): TriangleSpatial {
  const centroids = triangleCentroids(positions, indices);
  const n = indices.length / 3;
  const radii = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    let r = 0;
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k]! * 3;
      r = Math.max(
        r,
        Math.hypot(
          positions[v]! - centroids[t * 3]!,
          positions[v + 1]! - centroids[t * 3 + 1]!,
          positions[v + 2]! - centroids[t * 3 + 2]!,
        ),
      );
    }
    radii[t] = r;
  }
  return { positions, indices, centroids, radii };
}

/**
 * Triangles the brush sphere actually touches (closest point on the triangle
 * within `radius`), so large triangles of low-poly models can be painted too.
 */
export function trianglesTouchingSphere(
  s: TriangleSpatial,
  center: Vec3,
  radius: number,
): number[] {
  const out: number[] = [];
  const { positions: p, indices: ix, centroids: c, radii } = s;
  for (let t = 0; t < radii.length; t++) {
    const d = Math.hypot(
      c[t * 3]! - center[0],
      c[t * 3 + 1]! - center[1],
      c[t * 3 + 2]! - center[2],
    );
    if (d > radius + radii[t]!) continue;
    const a = ix[t * 3]! * 3;
    const b = ix[t * 3 + 1]! * 3;
    const cc = ix[t * 3 + 2]! * 3;
    const q = closestPointOnTriangle(
      center,
      [p[a]!, p[a + 1]!, p[a + 2]!],
      [p[b]!, p[b + 1]!, p[b + 2]!],
      [p[cc]!, p[cc + 1]!, p[cc + 2]!],
    );
    if (Math.hypot(q[0] - center[0], q[1] - center[1], q[2] - center[2]) <= radius) out.push(t);
  }
  return out;
}

/** Ericson, Real-Time Collision Detection §5.1.5. */
export function closestPointOnTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const sub = (u: Vec3, v: Vec3): Vec3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const add = (u: Vec3, v: Vec3, k: number): Vec3 => [
    u[0] + v[0] * k,
    u[1] + v[1] * k,
    u[2] + v[2] * k,
  ];
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, ab, d1 / (d1 - d3));
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return add(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return add(add(a, ab, v), ac, w);
}

/** Add or erase a dab's triangles; returns a new sorted array (stable storage order). */
export function applyBrush(
  current: readonly number[],
  dab: readonly number[],
  mode: 'add' | 'erase',
): number[] {
  const set = new Set(current);
  for (const t of dab) {
    if (mode === 'add') set.add(t);
    else set.delete(t);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Where a region's label attaches: on the region's own surface, at the
 * triangle nearest the area-weighted centroid, with the region's average normal.
 */
export function regionAnchor(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  triangles: readonly number[],
): { position: Vec3; normal: Vec3 } | null {
  if (triangles.length === 0) return null;
  let area = 0;
  const c = [0, 0, 0];
  const n = [0, 0, 0];
  const cents: [number, number, number][] = [];
  for (const t of triangles) {
    const [a, b, d] = [0, 1, 2].map((k) => indices[t * 3 + k]! * 3) as [number, number, number];
    const ux = positions[b]! - positions[a]!;
    const uy = positions[b + 1]! - positions[a + 1]!;
    const uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[d]! - positions[a]!;
    const vy = positions[d + 1]! - positions[a + 1]!;
    const vz = positions[d + 2]! - positions[a + 2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const ta = Math.hypot(nx, ny, nz) / 2;
    const cx = (positions[a]! + positions[b]! + positions[d]!) / 3;
    const cy = (positions[a + 1]! + positions[b + 1]! + positions[d + 1]!) / 3;
    const cz = (positions[a + 2]! + positions[b + 2]! + positions[d + 2]!) / 3;
    cents.push([cx, cy, cz]);
    area += ta;
    c[0] += cx * ta;
    c[1] += cy * ta;
    c[2] += cz * ta;
    n[0] += nx / 2; // area-weighted normal
    n[1] += ny / 2;
    n[2] += nz / 2;
  }
  const centroid = area > 0 ? c.map((v) => v / area) : cents[0]!;
  let best = cents[0]!;
  let bestD = Infinity;
  for (const p of cents) {
    const d = (p[0] - centroid[0]!) ** 2 + (p[1] - centroid[1]!) ** 2 + (p[2] - centroid[2]!) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  const len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
  return {
    position: [best[0], best[1], best[2]],
    normal: [n[0]! / len, n[1]! / len, n[2]! / len],
  };
}
