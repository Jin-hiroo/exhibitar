import { describe, expect, it } from 'vitest';
import { cube, sphereOnFlat, toBinaryStl } from '../../../tests/fixtures/shapes';
import { decodeGlb, encodeGlb, freezeModel, GLB_BUDGET_BYTES } from './glb';
import { computeBounds, scalePositions, triangleCount } from './mesh';
import { parseStl } from './parse-stl';
import { simplifyMesh } from './simplify';

const load = (t: Float32Array) => parseStl(toBinaryStl(t)).mesh;

/** Same triangle up to a cyclic rotation of its corners (winding preserved). */
function sameTriangle(a: number[], b: number[]): boolean {
  for (let r = 0; r < 3; r++) {
    if (a[0] === b[r] && a[1] === b[(r + 1) % 3] && a[2] === b[(r + 2) % 3]) return true;
  }
  return false;
}

describe('GLB encode/decode', () => {
  it('round-trips positions exactly and keeps triangle order', async () => {
    const mesh = scalePositions(load(sphereOnFlat()), 0.001);
    const glb = await encodeGlb(mesh);
    expect(new TextDecoder().decode(glb.slice(0, 4))).toBe('glTF');
    const back = await decodeGlb(glb);
    expect(Array.from(back.positions)).toEqual(Array.from(mesh.positions));
    expect(back.indices.length).toBe(mesh.indices.length);
    for (let t = 0; t < triangleCount(mesh); t++) {
      const a = Array.from(mesh.indices.subarray(t * 3, t * 3 + 3));
      const b = Array.from(back.indices.subarray(t * 3, t * 3 + 3));
      expect(sameTriangle(a, b)).toBe(true);
    }
  });

  it('compresses (smaller than the raw buffers)', async () => {
    const mesh = scalePositions(load(sphereOnFlat()), 0.001);
    const glb = await encodeGlb(mesh);
    const raw = mesh.positions.byteLength + mesh.indices.length * 2;
    expect(glb.byteLength).toBeLessThan(raw);
  });
});

describe('simplify + freeze', () => {
  it('simplifies a dense sphere to the target', async () => {
    const dense = load(sphereOnFlat({ segments: 400, rings: 200 }));
    expect(triangleCount(dense)).toBeGreaterThan(150_000);
    const { mesh, error } = await simplifyMesh(dense, 20_000);
    expect(triangleCount(mesh)).toBeLessThanOrEqual(20_000);
    expect(triangleCount(mesh)).toBeGreaterThan(15_000);
    expect(error).toBeLessThan(0.5); // mm on a 60 mm sphere
  });

  it('leaves small meshes alone and converts to metres', async () => {
    const frozen = await freezeModel(load(cube()));
    expect(frozen.triangleCount).toBe(12);
    expect(computeBounds(frozen.mesh.positions).size).toEqual([0.06, 0.06, 0.06].map(Math.fround));
  });

  it('keeps a 50k-triangle model under the GLB budget', async () => {
    const dense = load(sphereOnFlat({ segments: 400, rings: 200 }));
    const frozen = await freezeModel(dense, { targetTriangles: 50_000 });
    expect(frozen.triangleCount).toBeLessThanOrEqual(50_000);
    expect(frozen.glb.byteLength).toBeLessThan(GLB_BUDGET_BYTES);
    // the returned mesh is exactly what the file decodes to
    const again = await decodeGlb(frozen.glb);
    expect(Array.from(again.indices)).toEqual(Array.from(frozen.mesh.indices));
  });

  it('shrinks the target when the budget is tight', async () => {
    const dense = load(sphereOnFlat({ segments: 400, rings: 200 }));
    const frozen = await freezeModel(dense, { targetTriangles: 50_000, budgetBytes: 200_000 });
    expect(frozen.glb.byteLength).toBeLessThanOrEqual(200_000);
    expect(frozen.triangleCount).toBeLessThan(50_000);
  });
});
