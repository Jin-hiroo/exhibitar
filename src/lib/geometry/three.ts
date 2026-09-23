import { BufferAttribute, BufferGeometry } from 'three';
import { computeVertexNormals, type IndexedMesh } from './mesh';

/** Thin adapter: IndexedMesh → indexed three.js BufferGeometry with vertex normals. */
export function toBufferGeometry(mesh: IndexedMesh): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new BufferAttribute(computeVertexNormals(mesh), 3));
  g.setIndex(new BufferAttribute(mesh.indices, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
