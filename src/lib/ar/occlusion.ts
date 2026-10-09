import type { Vec3 } from '../types';
import type { PlacementMesh } from './label-placement';

/** Triangles per BVH leaf. */
const LEAF_SIZE = 8;
/** Hits this close to either end of the line (fraction of its length) do not count. */
const END_EPS = 1e-6;

/**
 * Line-of-sight test against the model: does the straight line from `from` to
 * `to` pass through any triangle (front or back face)?
 *
 * Labels are drawn on top of the model, so the scene uses this to hide a label as
 * a whole while the model is between it and the camera, instead of letting the
 * depth buffer cut the label off wherever the surrounding surface is nearer.
 *
 * A bounding volume hierarchy, built once in O(T log T), keeps each query to a
 * few box and triangle tests: cheap enough for every label, every frame.
 * All coordinates are model coords (metres).
 */
export function createOcclusionTest(mesh: PlacementMesh): (from: Vec3, to: Vec3) => boolean {
  const pos = mesh.positions;
  const tri = mesh.index ?? Uint32Array.from({ length: Math.floor(pos.length / 3) }, (_, i) => i);
  const bvh = buildBvh(pos, tri);
  if (!bvh) return () => false;
  const { box, first, count, order } = bvh;

  const stack: number[] = [];
  return (from, to) => {
    const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const inv: Vec3 = [1 / d[0], 1 / d[1], 1 / d[2]];
    stack.length = 0;
    stack.push(0);
    while (stack.length) {
      const node = stack.pop()!;
      if (!lineHitsBox(box, node * 6, from, inv)) continue;
      const n = count[node]!;
      const f = first[node]!;
      if (n === 0) {
        stack.push(f, f + 1);
        continue;
      }
      for (let i = f; i < f + n; i++) {
        const t = order[i]!;
        if (lineHitsTriangle(pos, tri[t * 3]!, tri[t * 3 + 1]!, tri[t * 3 + 2]!, from, d)) {
          return true;
        }
      }
    }
    return false;
  };
}

interface Bvh {
  /** per node: min xyz, max xyz of its triangles */
  box: Float64Array;
  /** leaf: first slot in `order`; inner node: its left child (the right one follows it) */
  first: Uint32Array;
  /** leaf: number of triangles; inner node: 0 */
  count: Uint32Array;
  /** triangle indices, grouped by leaf (the mesh itself is never reordered) */
  order: Uint32Array;
}

/** Binary BVH over the triangles, split at the middle of the longest side of their centres' box. */
function buildBvh(pos: ArrayLike<number>, tri: ArrayLike<number>): Bvh | null {
  const triangleCount = Math.floor(tri.length / 3);
  if (triangleCount === 0) return null;
  const order = new Uint32Array(triangleCount);
  // each triangle's box: min xyz, max xyz
  const tb = new Float64Array(triangleCount * 6);
  for (let t = 0; t < triangleCount; t++) {
    order[t] = t;
    for (let k = 0; k < 3; k++) {
      const a = pos[tri[t * 3]! * 3 + k]!;
      const b = pos[tri[t * 3 + 1]! * 3 + k]!;
      const c = pos[tri[t * 3 + 2]! * 3 + k]!;
      tb[t * 6 + k] = Math.min(a, b, c);
      tb[t * 6 + 3 + k] = Math.max(a, b, c);
    }
  }

  // every leaf holds at least one triangle, so there are at most 2T - 1 nodes
  const box = new Float64Array(2 * triangleCount * 6);
  const first = new Uint32Array(2 * triangleCount);
  const count = new Uint32Array(2 * triangleCount);
  let nodes = 1;
  const todo = [0, 0, triangleCount]; // (node, start, end) triples
  const lo = new Float64Array(3);
  const hi = new Float64Array(3);
  // triangle centres, doubled (min + max): only ever compared
  const cLo = new Float64Array(3);
  const cHi = new Float64Array(3);
  while (todo.length) {
    const end = todo.pop()!;
    const start = todo.pop()!;
    const node = todo.pop()!;
    lo.fill(Infinity);
    hi.fill(-Infinity);
    cLo.fill(Infinity);
    cHi.fill(-Infinity);
    for (let i = start; i < end; i++) {
      const o = order[i]! * 6;
      for (let k = 0; k < 3; k++) {
        const a = tb[o + k]!;
        const b = tb[o + 3 + k]!;
        if (a < lo[k]!) lo[k] = a;
        if (b > hi[k]!) hi[k] = b;
        if (a + b < cLo[k]!) cLo[k] = a + b;
        if (a + b > cHi[k]!) cHi[k] = a + b;
      }
    }
    box.set(lo, node * 6);
    box.set(hi, node * 6 + 3);

    const ex = cHi[0]! - cLo[0]!;
    const ey = cHi[1]! - cLo[1]!;
    const ez = cHi[2]! - cLo[2]!;
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    if (end - start <= LEAF_SIZE || !(Math.max(ex, ey, ez) > 0)) {
      first[node] = start;
      count[node] = end - start;
      continue;
    }
    const split = (cLo[axis]! + cHi[axis]!) / 2;
    let mid = start;
    for (let i = start; i < end; i++) {
      const t = order[i]!;
      if (tb[t * 6 + axis]! + tb[t * 6 + 3 + axis]! < split) {
        order[i] = order[mid]!;
        order[mid++] = t;
      }
    }
    // rounding can leave one side empty; any split still gives correct boxes
    if (mid === start || mid === end) mid = (start + end) >>> 1;
    const left = nodes;
    nodes += 2;
    first[node] = left;
    count[node] = 0;
    todo.push(left, start, mid, left + 1, mid, end);
  }
  return {
    box: box.slice(0, nodes * 6),
    first: first.slice(0, nodes),
    count: count.slice(0, nodes),
    order,
  };
}

/** Slab test of the line `o + s·d`, s in [0, 1] (`inv` = 1/d), against the box at `b`. */
function lineHitsBox(box: Float64Array, b: number, o: Vec3, inv: Vec3): boolean {
  let s0 = 0;
  let s1 = 1;
  for (let k = 0; k < 3; k++) {
    const lo = box[b + k]!;
    const hi = box[b + 3 + k]!;
    if (!Number.isFinite(inv[k])) {
      // parallel to this axis: inside the slab all along, or never
      if (o[k] < lo || o[k] > hi) return false;
      continue;
    }
    const near = (lo - o[k]) * inv[k];
    const far = (hi - o[k]) * inv[k];
    if (near < far) {
      if (near > s0) s0 = near;
      if (far < s1) s1 = far;
    } else {
      if (far > s0) s0 = far;
      if (near < s1) s1 = near;
    }
    if (s0 > s1) return false;
  }
  return true;
}

/**
 * Möller–Trumbore, both faces: does the line `o + s·d` cross the triangle with
 * vertices a, b, c strictly between its ends?
 */
function lineHitsTriangle(
  pos: ArrayLike<number>,
  a: number,
  b: number,
  c: number,
  o: Vec3,
  d: Vec3,
): boolean {
  const ax = pos[a * 3]!;
  const ay = pos[a * 3 + 1]!;
  const az = pos[a * 3 + 2]!;
  const e1x = pos[b * 3]! - ax;
  const e1y = pos[b * 3 + 1]! - ay;
  const e1z = pos[b * 3 + 2]! - az;
  const e2x = pos[c * 3]! - ax;
  const e2y = pos[c * 3 + 1]! - ay;
  const e2z = pos[c * 3 + 2]! - az;
  const [dx, dy, dz] = d;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-30) return false; // parallel to the triangle, or a degenerate one
  const inv = 1 / det;
  const sx = o[0] - ax;
  const sy = o[1] - ay;
  const sz = o[2] - az;
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return false;
  const s = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return s > END_EPS && s < 1 - END_EPS;
}
