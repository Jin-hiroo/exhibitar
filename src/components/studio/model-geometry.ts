import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { IndexedMesh } from '@/lib/geometry/mesh';

/** Frozen mesh (metres, model coords) → indexed BufferGeometry with normals. */
export function meshToGeometry(mesh: IndexedMesh): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  g.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** The stored GLB (the source of truth after publishing), baked into model coords. */
export async function loadStoredGeometry(url: string): Promise<BufferGeometry> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const root: Object3D = gltf.scene;
  root.updateMatrixWorld(true);
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (!found && (o as Mesh).isMesh) found = o as Mesh;
  });
  if (!found) throw new Error('GLB contains no mesh');
  const mesh = found as Mesh;
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Positions/indices of a BufferGeometry (for triangle-level tools). */
export function geometryArrays(g: BufferGeometry): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  const pos = g.getAttribute('position');
  const index = g.getIndex();
  return {
    positions: new Float32Array(pos.array as ArrayLike<number>),
    indices: index
      ? new Uint32Array(index.array as ArrayLike<number>)
      : Uint32Array.from({ length: pos.count }, (_, i) => i),
  };
}
