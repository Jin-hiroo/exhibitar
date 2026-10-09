import { describe, expect, it } from 'vitest';
import { sphereOnFlat, toBinaryStl } from '../../../tests/fixtures/shapes';
import { decodeGlb, freezeModel } from '../geometry/glb';
import { parseStl } from '../geometry/parse-stl';
import { move, newPoint, newRegion, normalizeOrder, remove, sanitizeLink, update } from './list';
import {
  applyBrush,
  buildTriangleSpatial,
  closestPointOnTriangle,
  regionAnchor,
  triangleCentroids,
  trianglesInSphere,
  trianglesTouchingSphere,
} from './region';

describe('region painting', () => {
  it('painted triangle indices round-trip through GLB save/load unchanged (TASKS C)', async () => {
    const frozen = await freezeModel(parseStl(toBinaryStl(sphereOnFlat())).mesh);
    const cents = triangleCentroids(frozen.mesh.positions, frozen.mesh.indices);
    // paint a dab on the sphere's side (model coords, metres)
    const dab = trianglesInSphere(cents, [0.03, 0, 0.026], 0.012);
    const region = applyBrush([], dab, 'add');
    expect(region.length).toBeGreaterThan(10);

    const reloaded = await decodeGlb(frozen.glb);
    const cents2 = triangleCentroids(reloaded.positions, reloaded.indices);
    for (const t of region) {
      for (let k = 0; k < 3; k++) expect(cents2[t * 3 + k]).toBe(cents[t * 3 + k]);
    }
  });

  it('paints large triangles of low-poly models (brush touches, centroid far away)', () => {
    // one big triangle; brush near a corner, far from the centroid
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const s = buildTriangleSpatial(positions, [0, 1, 2]);
    expect(trianglesInSphere(s.centroids, [0.05, 0.05, 0.002], 0.01)).toEqual([]);
    expect(trianglesTouchingSphere(s, [0.05, 0.05, 0.002], 0.01)).toEqual([0]);
    expect(trianglesTouchingSphere(s, [0.05, 0.05, 0.02], 0.01)).toEqual([]);
    expect(closestPointOnTriangle([2, 2, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0])).toEqual([
      0.5, 0.5, 0,
    ]);
  });

  it('adds and erases dabs, keeping a sorted set', () => {
    expect(applyBrush([5, 1], [3, 1], 'add')).toEqual([1, 3, 5]);
    expect(applyBrush([1, 3, 5], [3, 9], 'erase')).toEqual([1, 5]);
  });

  it('anchors a region on its own surface with its average normal', () => {
    // two triangles of the unit square in the z = 0 plane, facing +z
    const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
    const indices = [0, 1, 2, 0, 2, 3];
    const a = regionAnchor(positions, indices, [0, 1])!;
    expect(a.normal[2]).toBeCloseTo(1, 9);
    expect(a.position[2]).toBe(0);
    expect(regionAnchor(positions, indices, [])).toBeNull();
  });
});

describe('annotation list', () => {
  const anchor = {
    position: [0, 0, 0] as [number, number, number],
    normal: [0, 0, 1] as [number, number, number],
  };
  it('adds, edits, reorders and removes', () => {
    let list = [newPoint(anchor, 0), newRegion(anchor, [1, 2], 1), newPoint(anchor, 2)];
    const [a, b, c] = list.map((x) => x.id) as [string, string, string];
    list = update(list, b, { title: 'Jaw', triangles: [4, 5] });
    const jaw = list.find((x) => x.id === b)!;
    expect(jaw.title).toBe('Jaw');
    expect(jaw.kind === 'region' && jaw.triangles).toEqual([4, 5]);
    list = move(list, c, -1);
    expect(normalizeOrder(list).map((x) => x.id)).toEqual([a, c, b]);
    list = remove(list, a);
    expect(normalizeOrder(list).map((x) => [x.id, x.order])).toEqual([
      [c, 0],
      [b, 1],
    ]);
  });

  it('sets a label distance and clears it back to the default', () => {
    let list = [newPoint(anchor, 0)];
    const id = list[0]!.id;
    list = update(list, id, { labelOffsetMm: 60 });
    expect(list[0]!.labelOffsetMm).toBe(60);
    list = update(list, id, { labelOffsetMm: undefined });
    expect(JSON.parse(JSON.stringify(list[0]))).not.toHaveProperty('labelOffsetMm');
  });

  it('only accepts http(s) links', () => {
    expect(sanitizeLink('museum.org/skull')).toBe('https://museum.org/skull');
    expect(sanitizeLink('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeLink('  ')).toBeUndefined();
  });
});
