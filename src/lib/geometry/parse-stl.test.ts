import { describe, expect, it } from 'vitest';
import {
  cube,
  sphereOnFlat,
  toAsciiStl,
  toBinaryStl,
  tripod,
} from '../../../tests/fixtures/shapes';
import { computeBounds, triangleCount, vertexCount } from './mesh';
import { parseStl, StlParseError } from './parse-stl';

const ascii = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('parseStl', () => {
  it('parses a binary cube into 8 merged vertices and 12 triangles', () => {
    const { mesh, stats, warnings } = parseStl(toBinaryStl(cube()));
    expect(stats.format).toBe('binary');
    expect(triangleCount(mesh)).toBe(12);
    expect(vertexCount(mesh)).toBe(8);
    expect(stats.openEdges).toBe(0);
    expect(stats.nonManifoldEdges).toBe(0);
    expect(warnings).toEqual([]);
    expect(computeBounds(mesh.positions).size).toEqual([60, 60, 60]);
  });

  it('gives the same mesh for binary and ASCII input', () => {
    const tris = sphereOnFlat();
    const bin = parseStl(toBinaryStl(tris));
    const asc = parseStl(ascii(toAsciiStl(tris)));
    expect(asc.stats.format).toBe('ascii');
    expect(asc.stats.triangles).toBe(bin.stats.triangles);
    expect(asc.stats.vertices).toBe(bin.stats.vertices);
    expect(Array.from(asc.mesh.indices)).toEqual(Array.from(bin.mesh.indices));
    for (let i = 0; i < bin.mesh.positions.length; i++) {
      expect(asc.mesh.positions[i]).toBeCloseTo(bin.mesh.positions[i]!, 3);
    }
    expect(bin.stats.openEdges).toBe(0);
  });

  it('treats a binary file whose header starts with "solid" as binary', () => {
    const { stats } = parseStl(toBinaryStl(cube(), 'solid but actually binary'));
    expect(stats.format).toBe('binary');
  });

  it('keeps separate shells (tripod) and reports no open edges', () => {
    const { mesh, stats } = parseStl(toBinaryStl(tripod()));
    expect(triangleCount(mesh)).toBe(48);
    expect(stats.openEdges).toBe(0);
  });

  it('drops degenerate triangles and warns about holes', () => {
    const t = Array.from(cube());
    t.push(0, 0, 0, 0, 0, 0, 1, 1, 1); // degenerate
    const holed = new Float32Array(t.slice(9)); // remove first triangle → hole
    const { stats, warnings } = parseStl(toBinaryStl(holed));
    expect(stats.degenerateTriangles).toBe(1);
    expect(stats.triangles).toBe(11);
    expect(stats.openEdges).toBe(3);
    expect(warnings.join(' ')).toMatch(/not watertight/);
  });

  it('rejects garbage, empty files and NaNs', () => {
    expect(() => parseStl(ascii('hello world'))).toThrow(StlParseError);
    expect(() => parseStl(ascii('solid empty\nendsolid empty\n'))).toThrow(/no triangles/);
    const bad = cube();
    bad[4] = NaN;
    expect(() => parseStl(toBinaryStl(bad))).toThrow(/invalid/);
  });
});

describe('toBufferGeometry', () => {
  it('builds an indexed geometry with normals', async () => {
    const { toBufferGeometry } = await import('./three');
    const g = toBufferGeometry(parseStl(toBinaryStl(cube())).mesh);
    expect(g.index?.count).toBe(36);
    expect(g.getAttribute('position').count).toBe(8);
    expect(g.getAttribute('normal').count).toBe(8);
    expect(g.boundingBox?.max.z).toBe(60);
  });
});
