import { describe, expect, it } from 'vitest';
import legacyMat from '../../../tests/fixtures/mat.design2.json';
import mock from '../../../tests/fixtures/project.mock.json';
import type { ProjectRow } from './database.types';
import { rowToStudioProject, toProject, toRowUpdate } from './mapping';

const row: ProjectRow = {
  id: 'abc123def0',
  owner_id: '00000000-0000-0000-0000-000000000001',
  title: 'Skull',
  description: null,
  status: 'draft',
  geometry_version: 2,
  model: null,
  object_to_mat: null,
  calibration: { dxMm: 1, dyMm: 0, dzMm: -2, yawDeg: 0.5 },
  mat: null,
  annotations: [],
  view_count: 3,
  published_at: null,
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T01:00:00Z',
};

describe('project mapping', () => {
  it('maps a draft row (no geometry yet)', () => {
    const p = rowToStudioProject(row);
    expect(p).toMatchObject({
      id: 'abc123def0',
      ownerId: row.owner_id,
      title: 'Skull',
      description: undefined,
      status: 'draft',
      geometryVersion: 2,
      model: null,
      calibration: { dxMm: 1, dyMm: 0, dzMm: -2, yawDeg: 0.5 },
      viewCount: 3,
    });
    expect(toProject(p)).toBeNull();
  });

  it('round-trips a complete project through a row update', () => {
    const u = toRowUpdate({
      model: mock.model as never,
      objectToMat: mock.objectToMat,
      mat: mock.mat as never,
      annotations: mock.annotations as never,
      status: 'published',
    });
    const p = rowToStudioProject({ ...row, ...u } as ProjectRow);
    const full = toProject(p)!;
    expect(full.mat.tags).toEqual(mock.mat.tags);
    expect(full.objectToMat).toEqual(mock.objectToMat);
    expect(full.status).toBe('published');
    expect(Object.keys(toRowUpdate({ title: 'x' }))).toEqual(['title']);
  });

  it('still reads a mat stored before design 3 (image markers, no tags)', () => {
    const u = toRowUpdate({
      model: mock.model as never,
      objectToMat: mock.objectToMat,
      mat: legacyMat as never,
    });
    const full = toProject(rowToStudioProject({ ...row, ...u } as ProjectRow))!;
    expect(full.mat.tags).toBeUndefined();
    expect(full.mat.markers).toHaveLength(4);
    expect(full.mat.designVersion).toBe(2);
  });
});
