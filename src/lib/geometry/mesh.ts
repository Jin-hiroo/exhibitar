/**
 * Minimal indexed triangle mesh used throughout the geometry pipeline.
 * Plain typed arrays so it can be transferred to/from Web Workers.
 * Units are whatever the caller says (the pipeline uses millimetres until the
 * GLB boundary, where it switches to metres).
 */
export interface IndexedMesh {
  /** xyz per vertex */
  positions: Float32Array;
  /** 3 vertex indices per triangle, counter-clockwise seen from outside */
  indices: Uint32Array;
}

export type Vec3Tuple = [number, number, number];

export interface Bounds {
  min: Vec3Tuple;
  max: Vec3Tuple;
  size: Vec3Tuple;
}

export function triangleCount(mesh: IndexedMesh): number {
  return mesh.indices.length / 3;
}

export function vertexCount(mesh: IndexedMesh): number {
  return mesh.positions.length / 3;
}

export function computeBounds(positions: Float32Array): Bounds {
  if (positions.length === 0) throw new Error('empty positions');
  const min: Vec3Tuple = [Infinity, Infinity, Infinity];
  const max: Vec3Tuple = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/**
 * Per-triangle unit normals (3 floats each) and areas. Degenerate triangles get
 * a zero normal and zero area.
 */
export function faceNormalsAndAreas(mesh: IndexedMesh): {
  normals: Float32Array;
  areas: Float32Array;
} {
  const { positions: p, indices: ix } = mesh;
  const n = ix.length / 3;
  const normals = new Float32Array(n * 3);
  const areas = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    const a = ix[t * 3]! * 3;
    const b = ix[t * 3 + 1]! * 3;
    const c = ix[t * 3 + 2]! * 3;
    const ux = p[b]! - p[a]!;
    const uy = p[b + 1]! - p[a + 1]!;
    const uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!;
    const vy = p[c + 1]! - p[a + 1]!;
    const vz = p[c + 2]! - p[a + 2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    areas[t] = len / 2;
    if (len > 0) {
      normals[t * 3] = nx / len;
      normals[t * 3 + 1] = ny / len;
      normals[t * 3 + 2] = nz / len;
    }
  }
  return { normals, areas };
}

/** Area-weighted vertex normals (for shading). */
export function computeVertexNormals(mesh: IndexedMesh): Float32Array {
  const { positions: p, indices: ix } = mesh;
  const out = new Float32Array(p.length);
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3;
    const b = ix[t + 1]! * 3;
    const c = ix[t + 2]! * 3;
    const ux = p[b]! - p[a]!;
    const uy = p[b + 1]! - p[a + 1]!;
    const uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!;
    const vy = p[c + 1]! - p[a + 1]!;
    const vz = p[c + 2]! - p[a + 2]!;
    // unnormalised cross product = area-weighted normal
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      out[v] = out[v]! + nx;
      out[v + 1] = out[v + 1]! + ny;
      out[v + 2] = out[v + 2]! + nz;
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const len = Math.hypot(out[i]!, out[i + 1]!, out[i + 2]!) || 1;
    out[i] = out[i]! / len;
    out[i + 1] = out[i + 1]! / len;
    out[i + 2] = out[i + 2]! / len;
  }
  return out;
}

/**
 * Apply a 4×4 column-major affine transform (three.js `Matrix4.elements`)
 * to every vertex. Returns a new mesh sharing the index buffer.
 */
export function transformMesh(mesh: IndexedMesh, m: ArrayLike<number>): IndexedMesh {
  const p = mesh.positions;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i]!;
    const y = p[i + 1]!;
    const z = p[i + 2]!;
    out[i] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    out[i + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    out[i + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  }
  return { positions: out, indices: mesh.indices };
}

/** Uniformly scale positions. Returns a new mesh sharing the index buffer. */
export function scalePositions(mesh: IndexedMesh, s: number): IndexedMesh {
  const out = new Float32Array(mesh.positions.length);
  for (let i = 0; i < out.length; i++) out[i] = mesh.positions[i]! * s;
  return { positions: out, indices: mesh.indices };
}

/**
 * Drop unreferenced vertices. Vertices are renumbered in order of first use in
 * the index buffer (deterministic, cache-friendly). Triangle order is preserved.
 */
export function compactMesh(positions: Float32Array, indices: Uint32Array): IndexedMesh {
  const remap = new Int32Array(positions.length / 3).fill(-1);
  const newIndices = new Uint32Array(indices.length);
  let next = 0;
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i]!;
    if (remap[v] === -1) remap[v] = next++;
    newIndices[i] = remap[v]!;
  }
  const newPositions = new Float32Array(next * 3);
  for (let v = 0; v < remap.length; v++) {
    const r = remap[v]!;
    if (r >= 0) {
      newPositions[r * 3] = positions[v * 3]!;
      newPositions[r * 3 + 1] = positions[v * 3 + 1]!;
      newPositions[r * 3 + 2] = positions[v * 3 + 2]!;
    }
  }
  return { positions: newPositions, indices: newIndices };
}

/**
 * Centre of mass. Uses the enclosed volume (signed tetrahedra) when the mesh
 * is closed enough to have a meaningful volume, otherwise the surface-area
 * centroid.
 */
export function centreOfMass(mesh: IndexedMesh): Vec3Tuple {
  const { positions: p, indices: ix } = mesh;
  let vol = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let area = 0;
  let ax = 0;
  let ay = 0;
  let az = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3;
    const b = ix[t + 1]! * 3;
    const c = ix[t + 2]! * 3;
    const x0 = p[a]!;
    const y0 = p[a + 1]!;
    const z0 = p[a + 2]!;
    const x1 = p[b]!;
    const y1 = p[b + 1]!;
    const z1 = p[b + 2]!;
    const x2 = p[c]!;
    const y2 = p[c + 1]!;
    const z2 = p[c + 2]!;
    const v = (x0 * (y1 * z2 - z1 * y2) - y0 * (x1 * z2 - z1 * x2) + z0 * (x1 * y2 - y1 * x2)) / 6;
    vol += v;
    cx += (v * (x0 + x1 + x2)) / 4;
    cy += (v * (y0 + y1 + y2)) / 4;
    cz += (v * (z0 + z1 + z2)) / 4;
    const ux = x1 - x0;
    const uy = y1 - y0;
    const uz = z1 - z0;
    const wx = x2 - x0;
    const wy = y2 - y0;
    const wz = z2 - z0;
    const ta = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    area += ta;
    ax += (ta * (x0 + x1 + x2)) / 3;
    ay += (ta * (y0 + y1 + y2)) / 3;
    az += (ta * (z0 + z1 + z2)) / 3;
  }
  const b = computeBounds(p);
  const bboxVol = Math.max(b.size[0] * b.size[1] * b.size[2], 1e-12);
  // A closed, consistently wound mesh has a positive volume of the same order as its bbox.
  if (vol > bboxVol * 1e-3) return [cx / vol, cy / vol, cz / vol];
  if (area > 0) return [ax / area, ay / area, az / area];
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}
