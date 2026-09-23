import type { StudioProject } from '@/lib/db/mapping';

export function newStudioProject(id: string, ownerId: string): StudioProject {
  const now = new Date().toISOString();
  return {
    id,
    ownerId,
    title: '',
    description: undefined,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    geometryVersion: 1,
    model: null,
    objectToMat: null,
    calibration: { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 },
    mat: null,
    annotations: [],
    viewCount: 0,
    publishedAt: null,
  };
}
