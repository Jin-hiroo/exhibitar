import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { sphereOnFlat, toBinaryStl } from '../../../tests/fixtures/shapes';
import { parseStl } from '../geometry/parse-stl';
import { toBufferGeometry } from '../geometry/three';
import { anchorFromHit, enableFastRaycast } from './picking';

describe('picking', () => {
  it('builds a BVH without reordering triangles (region indices stay valid)', () => {
    const mesh = new Mesh(
      toBufferGeometry(parseStl(toBinaryStl(sphereOnFlat())).mesh),
      new MeshBasicMaterial(),
    );
    const before = Array.from(mesh.geometry.getIndex()!.array);
    const plain = new Raycaster(new Vector3(0, -200, 26), new Vector3(0, 1, 0));
    const expected = plain.intersectObject(mesh)[0]!;

    const dispose = enableFastRaycast(mesh);
    expect(Array.from(mesh.geometry.getIndex()!.array)).toEqual(before);
    const fast = new Raycaster(new Vector3(0, -200, 26), new Vector3(0, 1, 0));
    const hit = fast.intersectObject(mesh)[0]!;
    expect(hit.faceIndex).toBe(expected.faceIndex);
    expect(hit.point.distanceTo(expected.point)).toBeLessThan(1e-9);

    const anchor = anchorFromHit(mesh, hit)!;
    expect(anchor.position[1]).toBeCloseTo(hit.point.y, 9);
    expect(Math.hypot(...anchor.normal)).toBeCloseTo(1, 9);
    dispose();
  });
});
