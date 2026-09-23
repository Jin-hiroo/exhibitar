import { describe, expect, it } from 'vitest';
import type { Annotation, Marker, Project, Vec3 } from '@/lib/types';
import raw from './project.mock.json';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isPt = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const isPolys = (v: unknown) =>
  Array.isArray(v) &&
  v.every((ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(isPt));

function checkMarker(m: Marker) {
  expect(typeof m.id).toBe('string');
  expect(typeof m.imagePath).toBe('string');
  expect(m.widthMm).toBeGreaterThan(0);
  expect(isPt(m.centerMm)).toBe(true);
  expect(isNum(m.rotationDeg)).toBe(true);
  expect(Number.isInteger(m.seed)).toBe(true);
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
    expect(p.mat.markers.length).toBeGreaterThanOrEqual(3);
    p.mat.markers.forEach(checkMarker);
    p.annotations.forEach(checkAnnotation);
  });

  it('keeps markers on the paper', () => {
    const [w, h] = p.mat.sizeMm;
    for (const m of p.mat.markers) {
      expect(Math.abs(m.centerMm[0]) + m.widthMm / 2).toBeLessThanOrEqual(w / 2);
      expect(Math.abs(m.centerMm[1]) + m.widthMm / 2).toBeLessThanOrEqual(h / 2);
    }
  });
});
