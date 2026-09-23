import { faceNormalsAndAreas, type IndexedMesh } from './mesh';

/** Vertices within this height (mm) of the lowest point count as touching the table. */
export const CONTACT_EPSILON_MM = 0.3;
/** Triangles tilted more than this from straight down are not contact faces. */
export const CONTACT_MAX_TILT_DEG = 30;

export interface ContactSelection {
  /** indices of triangles lying on the table */
  triangles: Uint32Array;
  minY: number;
  /** XZ bounding box of the contact triangles (or of the lowest vertices if none) */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * Triangles of a mesh in the mat frame (mm, Y-up) that rest on the table:
 * all three vertices within `epsMm` of the lowest point and facing down.
 * Shared by orientation (footprint centring) and footprint outlines so the
 * two always agree.
 */
export function findContactTriangles(
  mesh: IndexedMesh,
  epsMm = CONTACT_EPSILON_MM,
  maxTiltDeg = CONTACT_MAX_TILT_DEG,
): ContactSelection {
  const { positions: p, indices: ix } = mesh;
  let minY = Infinity;
  for (let i = 1; i < p.length; i += 3) if (p[i]! < minY) minY = p[i]!;
  const limit = minY + epsMm;
  const cosTilt = Math.cos((maxTiltDeg * Math.PI) / 180);
  const { normals } = faceNormalsAndAreas(mesh);

  const tris: number[] = [];
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const grow = (v: number) => {
    const x = p[v * 3]!;
    const z = p[v * 3 + 2]!;
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (z < b.minZ) b.minZ = z;
    if (z > b.maxZ) b.maxZ = z;
  };
  for (let t = 0; t < ix.length / 3; t++) {
    const a = ix[t * 3]!;
    const bb = ix[t * 3 + 1]!;
    const c = ix[t * 3 + 2]!;
    if (p[a * 3 + 1]! > limit || p[bb * 3 + 1]! > limit || p[c * 3 + 1]! > limit) continue;
    if (-normals[t * 3 + 1]! < cosTilt) continue;
    tris.push(t);
    grow(a);
    grow(bb);
    grow(c);
  }
  if (tris.length === 0) {
    // pointy bottom: fall back to the lowest vertices
    for (let v = 0; v < p.length / 3; v++) if (p[v * 3 + 1]! <= limit) grow(v);
  }
  return { triangles: Uint32Array.from(tris), minY, bounds: b };
}
