import { findContactTriangles } from './contact';
import { faceNormalsAndAreas, triangleCount, type IndexedMesh } from './mesh';
import * as poly from './polygons';
import type { Polygons } from './polygons';
import { simplifyMesh } from './simplify';

/** Closes hairline gaps between adjacent projected triangles. */
const GAP_CLOSE_MM = 0.05;
const SIMPLIFY_MM = 0.1;
const MIN_ISLAND_MM2 = 1;
const SHADOW_TARGET_TRIANGLES = 5_000;

export interface Footprint {
  /** where the object touches the paper (mat XZ, mm) — solid line on the mat */
  contactOutlineMm: Polygons;
  /** top-down silhouette (mat XZ, mm) — dashed line on the mat */
  shadowOutlineMm: Polygons;
  contactAreaMm2: number;
  shadowAreaMm2: number;
  contactIslands: number;
  /** contact is tiny or fragmented: the mat should emphasise the shadow outline */
  contactWeak: boolean;
}

/**
 * Contact and shadow outlines of an oriented mesh (mat frame, mm, resting on
 * y = 0). Points are [x, z] in the mat plane.
 */
export async function computeFootprint(orientedMm: IndexedMesh): Promise<Footprint> {
  const contact = contactOutline(orientedMm);

  // Shadow from a further-decimated mesh, grown by the simplification error
  // so it never under-estimates the real silhouette.
  const coarse =
    triangleCount(orientedMm) > SHADOW_TARGET_TRIANGLES
      ? await simplifyMesh(orientedMm, SHADOW_TARGET_TRIANGLES)
      : { mesh: orientedMm, error: 0 };
  let shadow = poly.union(projectTriangles(coarse.mesh, allTriangles(coarse.mesh)));
  // grow only (never shrink): closes hairline gaps and covers simplification error
  shadow = poly.offset(poly.union([...shadow, ...contact]), GAP_CLOSE_MM + coarse.error);
  shadow = poly.dropSmall(poly.simplify(shadow, SIMPLIFY_MM), MIN_ISLAND_MM2);

  const contactAreaMm2 = poly.area(contact);
  const shadowAreaMm2 = poly.area(shadow);
  const contactIslands = poly.outerRingCount(contact);
  return {
    contactOutlineMm: contact,
    shadowOutlineMm: shadow,
    contactAreaMm2,
    shadowAreaMm2,
    contactIslands,
    contactWeak:
      contactAreaMm2 < 25 || contactAreaMm2 < 0.05 * shadowAreaMm2 || contactIslands > 12,
  };
}

export function contactOutline(orientedMm: IndexedMesh): Polygons {
  const { triangles } = findContactTriangles(orientedMm);
  const merged = poly.union(projectTriangles(orientedMm, triangles));
  // grow then shrink: closes hairline gaps without changing the outline
  const closed = poly.offset(poly.offset(merged, GAP_CLOSE_MM), -GAP_CLOSE_MM);
  return poly.dropSmall(poly.simplify(closed, SIMPLIFY_MM), MIN_ISLAND_MM2);
}

function allTriangles(mesh: IndexedMesh): Uint32Array {
  const { areas } = faceNormalsAndAreas(mesh);
  const out: number[] = [];
  for (let t = 0; t < areas.length; t++) if (areas[t]! > 0) out.push(t);
  return Uint32Array.from(out);
}

/** Project triangles onto XZ as CCW rings (vertical faces skipped). */
function projectTriangles(mesh: IndexedMesh, tris: Uint32Array): Polygons {
  const { positions: p, indices: ix } = mesh;
  const rings: Polygons = [];
  for (const t of tris) {
    const ring: poly.Ring = [0, 1, 2].map((k) => {
      const v = ix[t * 3 + k]! * 3;
      return [p[v]!, p[v + 2]!] as [number, number];
    });
    const a = poly.signedArea(ring);
    if (Math.abs(a) < 1e-6) continue; // vertical face: no shadow
    rings.push(a > 0 ? ring : ring.reverse());
  }
  return rings;
}
