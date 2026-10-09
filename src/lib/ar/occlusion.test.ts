import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../types';
import type { PlacementMesh } from './label-placement';
import { createOcclusionTest } from './occlusion';

/** An axis-aligned box (metres) as an indexed mesh. */
function box(lo: Vec3, hi: Vec3): PlacementMesh {
  const positions: number[] = [];
  for (let i = 0; i < 8; i++) {
    positions.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]);
  }
  const faces = [
    [0, 4, 6, 2],
    [1, 3, 7, 5],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 2, 3, 1],
    [4, 5, 7, 6],
  ];
  const index = faces.flatMap(([a, b, c, d]) => [a!, b!, c!, a!, c!, d!]);
  return { positions, index };
}

/** Deterministic PRNG (mulberry32) in [0, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reference: plane crossing + same-side tests, every triangle. */
function bruteForce(mesh: PlacementMesh, from: Vec3, to: Vec3): boolean {
  const p = mesh.positions;
  const ix = mesh.index!;
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const v = (i: number): Vec3 => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
  const d = sub(to, from);
  for (let t = 0; t < ix.length / 3; t++) {
    const [a, b, c] = [v(ix[t * 3]!), v(ix[t * 3 + 1]!), v(ix[t * 3 + 2]!)];
    const n = cross(sub(b, a), sub(c, a));
    const denom = dot(n, d);
    if (denom === 0) continue;
    const s = dot(n, sub(a, from)) / denom;
    if (s <= 1e-6 || s >= 1 - 1e-6) continue;
    const q: Vec3 = [from[0] + d[0] * s, from[1] + d[1] * s, from[2] + d[2] * s];
    const inside = [
      [a, b],
      [b, c],
      [c, a],
    ].every(([e0, e1]) => dot(cross(sub(e1!, e0!), sub(q, e0!)), n) >= 0);
    if (inside) return true;
  }
  return false;
}

describe('createOcclusionTest', () => {
  const cube = box([-0.02, 0, -0.02], [0.02, 0.04, 0.02]);
  const blocked = createOcclusionTest(cube);

  it('blocks a line through the model, not one beside, short of or past it', () => {
    expect(blocked([0, 0.02, 0.5], [0, 0.02, -0.5])).toBe(true);
    expect(blocked([0.3, 0.3, 0.4], [-0.05, -0.01, -0.03])).toBe(true);
    expect(blocked([0.03, 0.02, 0.5], [0.03, 0.02, -0.5])).toBe(false);
    expect(blocked([0, 0.02, 0.5], [0, 0.02, 0.03])).toBe(false);
    expect(blocked([0, 0.02, -0.03], [0, 0.02, -0.5])).toBe(false);
    expect(blocked([0, 0.06, 0.5], [0, 0.06, -0.5])).toBe(false);
  });

  it('counts back faces: a line from inside the model out is blocked', () => {
    expect(blocked([0, 0.02, 0], [0, 0.02, 0.5])).toBe(true);
    expect(blocked([0, 0.02, 0], [0.4, 0.3, 0.2])).toBe(true);
  });

  it('does not count a surface the line only touches at an end', () => {
    expect(blocked([0, 0.02, 0.5], [0, 0.02, 0.02])).toBe(false);
    expect(blocked([0, 0.04, 0], [0, 0.5, 0])).toBe(false);
  });

  it('agrees with a brute-force test on a random triangle soup', () => {
    const r = rng(7);
    const positions: number[] = [];
    const index: number[] = [];
    for (let t = 0; t < 3000; t++) {
      const c = [r() * 0.2, r() * 0.2, r() * 0.2];
      for (let k = 0; k < 3; k++) {
        index.push(positions.length / 3);
        positions.push(...c.map((x) => x + (r() - 0.5) * 0.03));
      }
    }
    const soup = { positions, index };
    const test = createOcclusionTest(soup);
    let hits = 0;
    for (let i = 0; i < 500; i++) {
      const from: Vec3 = [r() * 0.4 - 0.1, r() * 0.4 - 0.1, r() * 0.4 - 0.1];
      const to: Vec3 =
        i % 5 === 0
          ? [from[0] + (r() - 0.5) * 0.02, from[1], from[2]] // short, often in a gap
          : [r() * 0.4 - 0.1, r() * 0.4 - 0.1, r() * 0.4 - 0.1];
      const expected = bruteForce(soup, from, to);
      expect(test(from, to)).toBe(expected);
      if (expected) hits++;
    }
    expect(hits).toBeGreaterThan(50);
    expect(hits).toBeLessThan(450);
  });

  it('copes with triangles that share one centroid (no split possible)', () => {
    // a fan of 40 upright triangles turned about the y axis, all centred on (0, 1/3 mm, 0)
    const positions: number[] = [];
    const index: number[] = [];
    for (let i = 0; i < 40; i++) {
      const a = (i * Math.PI) / 40;
      const [x, z] = [0.01 * Math.cos(a), 0.01 * Math.sin(a)];
      index.push(i * 3, i * 3 + 1, i * 3 + 2);
      positions.push(x, 0, z, -x, 0, -z, 0, 0.001, 0);
    }
    const test = createOcclusionTest({ positions, index });
    expect(test([0.004, 0.0002, 0.5], [0.004, 0.0002, -0.5])).toBe(true);
    expect(test([0.004, 0.01, 0.5], [0.004, 0.01, -0.5])).toBe(false);
  });

  it('handles non-indexed and empty meshes', () => {
    const flat = Array.from(cube.index!, (i) =>
      [0, 1, 2].map((k) => cube.positions[i * 3 + k]!),
    ).flat();
    const test = createOcclusionTest({ positions: flat, index: null });
    expect(test([0, 0.02, 0.5], [0, 0.02, -0.5])).toBe(true);
    expect(test([0.03, 0.02, 0.5], [0.03, 0.02, -0.5])).toBe(false);
    expect(createOcclusionTest({ positions: [], index: null })([0, 0, 1], [0, 0, -1])).toBe(false);
  });
});
