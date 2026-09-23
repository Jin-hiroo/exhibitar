import { MeshoptSimplifier } from 'meshoptimizer';
import { compactMesh, triangleCount, type IndexedMesh } from './mesh';

export interface SimplifyResult {
  mesh: IndexedMesh;
  /** geometric deviation introduced by simplification, in mesh units */
  error: number;
}

/**
 * Reduce a mesh to about `targetTriangles` with meshoptimizer. The triangle
 * budget is the primary goal; `maxRelativeError` (fraction of the mesh extent)
 * is only a safety cap. Meshes already under target are returned compacted.
 */
export async function simplifyMesh(
  mesh: IndexedMesh,
  targetTriangles: number,
  maxRelativeError = 0.05,
): Promise<SimplifyResult> {
  if (triangleCount(mesh) <= targetTriangles) {
    return { mesh: compactMesh(mesh.positions, mesh.indices), error: 0 };
  }
  await MeshoptSimplifier.ready;
  const [indices, relErr] = MeshoptSimplifier.simplify(
    mesh.indices,
    mesh.positions,
    3,
    targetTriangles * 3,
    maxRelativeError,
  );
  const scale = MeshoptSimplifier.getScale(mesh.positions, 3);
  return { mesh: compactMesh(mesh.positions, indices), error: relErr * scale };
}
