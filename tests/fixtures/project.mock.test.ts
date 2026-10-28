import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBoard } from 'matar';
import { describe, expect, it } from 'vitest';
import { decodeGlb } from '@/lib/geometry/glb';
import type { Annotation, MatTag, Project, Vec3 } from '@/lib/types';
import raw from './project.mock.json';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isPt = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const isPolys = (v: unknown) =>
  Array.isArray(v) &&
  v.every((ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(isPt));

function checkTag(t: MatTag) {
  expect(Number.isInteger(t.id)).toBe(true);
  expect(t.sizeMm).toBeGreaterThan(0);
  expect(isPt(t.centerMm)).toBe(true);
  expect(isNum(t.rotationDeg)).toBe(true);
}

function checkAnnotation(a: Annotation) {
  expect(typeof a.title).toBe('string');
  expect(typeof a.body).toBe('string');
  expect(isVec3(a.anchor.position)).toBe(true);
  expect(isVec3(a.anchor.normal)).toBe(true);
  expect(Math.hypot(...a.anchor.normal)).toBeCloseTo(1, 6);
  if (a.kind === 'region') {
    expect(a.triangles.every((t) => Number.isInteger(t) && t >= 0)).toBe(true);
  } else {
    expect(a.kind).toBe('point');
  }
}

describe('project.mock.json', () => {
  // The JSON import widens tuples; the structural checks below are what make this cast honest.
  const p = raw as unknown as Project;

  it('has the Project shape', () => {
    expect(p.id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(['draft', 'published']).toContain(p.status);
    expect(Number.isInteger(p.geometryVersion)).toBe(true);
    expect(isVec3(p.model.boundsMm.size)).toBe(true);
    expect(p.model.triangleCount).toBeGreaterThan(0);
    expect(p.objectToMat).toHaveLength(16);
    expect(p.objectToMat.every(isNum)).toBe(true);
    expect(Object.keys(p.calibration).sort()).toEqual(['dxMm', 'dyMm', 'dzMm', 'yawDeg']);
    expect(['A4', 'A3', 'Letter', 'Tabloid']).toContain(p.mat.paper);
    expect(['portrait', 'landscape']).toContain(p.mat.orientation);
    expect(isPt(p.mat.sizeMm)).toBe(true);
    expect(isPolys(p.mat.contactOutlineMm)).toBe(true);
    expect(isPolys(p.mat.shadowOutlineMm)).toBe(true);
    expect(p.mat.tagFamily).toBe('tag36h11');
    expect(p.mat.tags!.length).toBeGreaterThanOrEqual(12);
    p.mat.tags!.forEach(checkTag);
    expect(p.mat.markers).toBeUndefined();
    expect(p.mat.trackImage).toBeUndefined();
    p.annotations.forEach(checkAnnotation);
  });

  it('has tags that make a valid matar board', () => {
    expect(() => createBoard({ family: p.mat.tagFamily, tags: p.mat.tags! })).not.toThrow();
  });

  it('keeps the tags and their white ring on the paper (the cube sits at the page centre)', () => {
    const [w, h] = p.mat.sizeMm;
    for (const t of p.mat.tags!) {
      const half = (t.sizeMm * 10) / 8 / 2;
      expect(Math.abs(t.centerMm[0]) + half).toBeLessThanOrEqual(w / 2);
      expect(Math.abs(t.centerMm[1]) + half).toBeLessThanOrEqual(h / 2);
    }
  });

  it('matches its generated assets in public/fixtures', async () => {
    const pub = join(__dirname, '../../public');
    const mesh = await decodeGlb(new Uint8Array(readFileSync(join(pub, p.model.glbPath))));
    expect(mesh.indices.length / 3).toBe(p.model.triangleCount);
    for (const a of p.annotations) {
      if (a.kind === 'region') {
        expect(a.triangles.length).toBeGreaterThan(0);
        expect(Math.max(...a.triangles)).toBeLessThan(p.model.triangleCount);
      }
    }
    expect(existsSync(join(pub, p.mat.svgPath))).toBe(true);
  });
});
