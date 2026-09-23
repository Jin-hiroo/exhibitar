import { BufferGeometry, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { ViewerProject } from '../types';

export interface ExhibitAssets {
  /** the stored simplified mesh, model coords (metres), triangle order preserved */
  geometry: BufferGeometry;
  /** marker images in `project.mat.markers` order, for the image tracker */
  markerBitmaps: ImageBitmap[];
  /** marker image URLs in the same order (for textures) */
  markerUrls: string[];
}

export function resolveAsset(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Load the frozen GLB (meshopt-compressed) and the marker PNGs. */
export async function loadExhibitAssets(
  project: ViewerProject,
  base: string,
): Promise<ExhibitAssets> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const markerUrls = project.mat.markers.map((m) => resolveAsset(base, m.imagePath));
  const [gltf, markerBitmaps] = await Promise.all([
    loader.loadAsync(resolveAsset(base, project.model.glbPath)),
    Promise.all(
      markerUrls.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`marker image ${url}: HTTP ${res.status}`);
        return createImageBitmap(await res.blob());
      }),
    ),
  ]);
  return { geometry: firstMeshGeometry(gltf.scene), markerBitmaps, markerUrls };
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
