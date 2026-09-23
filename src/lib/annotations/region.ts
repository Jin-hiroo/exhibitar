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
