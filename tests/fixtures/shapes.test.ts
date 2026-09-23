import { describe, expect, it } from 'vitest';
import { cube, FIXTURES, lBlock, sphereOnFlat, toAsciiStl, toBinaryStl, tripod } from './shapes';

/** Signed volume via the divergence theorem; positive when faces point outward. */
function volume(t: Float32Array): number {
  let v = 0;
  for (let i = 0; i < t.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = Array.from(t.subarray(i, i + 9)) as number[];
    v +=
      (ax! * (by! * cz! - bz! * cy!) -
        ay! * (bx! * cz! - bz! * cx!) +
        az! * (bx! * cy! - by! * cx!)) /
      6;
  }
  return v;
}

/** Every directed edge must be matched by its reverse (closed, consistently wound). */
function isClosed(t: Float32Array): boolean {
  const key = (i: number) => `${t[i]!.toFixed(4)},${t[i + 1]!.toFixed(4)},${t[i + 2]!.toFixed(4)}`;
  const edges = new Map<string, number>();
  for (let i = 0; i < t.length; i += 9) {
    const v = [key(i), key(i + 3), key(i + 6)];
    for (let e = 0; e < 3; e++) {
      const k = `${v[e]}|${v[(e + 1) % 3]}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of edges) {
    const [a, b] = k.split('|');
    if (edges.get(`${b}|${a}`) !== n) return false;
  }
  return true;
}

describe('fixture shapes', () => {
  it('cube is closed with volume 60³', () => {
    const t = cube();
    expect(t.length / 9).toBe(12);
    expect(isClosed(t)).toBe(true);
    expect(volume(t)).toBeCloseTo(60 ** 3, 0);
  });

  it('L-block is closed with the expected volume', () => {
    const t = lBlock();
    expect(isClosed(t)).toBe(true);
    expect(volume(t)).toBeCloseTo(3200 * 40, 0);
  });

  it('tripod is plate + 3 feet', () => {
    const t = tripod();
    expect(t.length / 9).toBe(12 * 4);
    expect(volume(t)).toBeCloseTo(60 * 60 * 5 + 3 * 6 * 6 * 10.5, 0);
  });

  it('sphere-on-flat is closed, outward, and rests on z = 0', () => {
    const t = sphereOnFlat();
    expect(isClosed(t)).toBe(true);
    expect(volume(t)).toBeGreaterThan(0);
    let minZ = Infinity;
    for (let i = 2; i < t.length; i += 3) minZ = Math.min(minZ, t[i]!);
    expect(minZ).toBe(0);
  });

  it('writes binary STL with the right size and ASCII STL with every facet', () => {
    for (const build of Object.values(FIXTURES)) {
      const t = build();
      const n = t.length / 9;
      const bin = toBinaryStl(t);
      expect(bin.byteLength).toBe(84 + 50 * n);
      expect(new DataView(bin).getUint32(80, true)).toBe(n);
      const ascii = toAsciiStl(t);
      expect(ascii.match(/endfacet/g)?.length).toBe(n);
    }
  });
});
