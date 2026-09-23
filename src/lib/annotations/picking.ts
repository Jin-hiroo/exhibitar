import type { Intersection, Mesh } from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { Vec3 } from '../types';

/**
 * Point picking on the stored mesh (TASKS C1). The mesh's local space is the
 * model frame (metres), so anchors come straight out of local coordinates.
 */

/** BVH-accelerated raycasts (interactive painting on ~50k-triangle meshes). */
export function enableFastRaycast(mesh: Mesh): () => void {
  // three-mesh-bvh's module augmentation and @types/three disagree on the option
  // types; the functions themselves are the documented way to patch a geometry.
  const g = mesh.geometry as unknown as {
    computeBoundsTree: typeof computeBoundsTree;
    disposeBoundsTree: typeof disposeBoundsTree;
  };
  g.computeBoundsTree = computeBoundsTree;
  g.disposeBoundsTree = disposeBoundsTree;
  // `indirect`: never reorder the index buffer — triangle indices must stay those of
  // the stored GLB (regions store them; CLAUDE.md core idea #3)
  g.computeBoundsTree({ indirect: true });
  mesh.raycast = acceleratedRaycast;
  return () => g.disposeBoundsTree();
}

/** Anchor (model coords) for a hit on `mesh`: the hit point and the face normal. */
export function anchorFromHit(
  mesh: Mesh,
  hit: Pick<Intersection, 'point' | 'face'>,
): { position: Vec3; normal: Vec3 } | null {
  if (!hit.face) return null;
  const p = mesh.worldToLocal(hit.point.clone());
  const n = hit.face.normal.clone().normalize();
  return { position: [p.x, p.y, p.z], normal: [n.x, n.y, n.z] };
}
