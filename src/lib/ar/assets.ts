import { BufferGeometry, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { ViewerProject } from '../types';
import { resolveAsset } from './asset-url';

export { resolveAsset };

export interface ExhibitAssets {
  /** the stored simplified mesh, model coords (metres), triangle order preserved */
  geometry: BufferGeometry;
  /**
   * design ≤ 2 mats only: marker image URLs in `project.mat.markers` order, for
   * the 3D view's picture of the mat (loaded there as textures; AR doesn't use them)
   */
  markerUrls: string[];
}

/**
 * Load the frozen GLB (meshopt-compressed). AR needs nothing else: matar
 * tracks the printed tags from their IDs and positions in the project data.
 */
export async function loadExhibitAssets(
  project: ViewerProject,
  base: string,
): Promise<ExhibitAssets> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const markerUrls = (project.mat.markers ?? []).map((m) => resolveAsset(base, m.imagePath));
  const gltf = await loader.loadAsync(resolveAsset(base, project.model.glbPath));
  return { geometry: firstMeshGeometry(gltf.scene), markerUrls };
}

/** The GLB holds exactly one mesh; bake its node transform so geometry = model coords. */
function firstMeshGeometry(root: Object3D): BufferGeometry {
  root.updateMatrixWorld(true);
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (!found && (o as Mesh).isMesh) found = o as Mesh;
  });
  if (!found) throw new Error('GLB contains no mesh');
  const mesh = found as Mesh;
  return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
}
