import type { Annotation, Project } from '../types';
import type { Json, ProjectRow, ProjectUpdate } from './database.types';

/**
 * A project as the Studio edits it: like `Project`, but geometry and mat are
 * missing until the exhibitor has prepared a model.
 */
export interface StudioProject extends Omit<Project, 'model' | 'objectToMat' | 'mat'> {
  model: Project['model'] | null;
  objectToMat: number[] | null;
  mat: Project['mat'] | null;
  viewCount: number;
  publishedAt: string | null;
}

const ZERO_CALIBRATION: Project['calibration'] = { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 };

export function rowToStudioProject(row: ProjectRow): StudioProject {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status === 'published' ? 'published' : 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    geometryVersion: row.geometry_version,
    model: (row.model as unknown as Project['model'] | null) ?? null,
    objectToMat: (row.object_to_mat as unknown as number[] | null) ?? null,
    calibration: (row.calibration as unknown as Project['calibration'] | null) ?? ZERO_CALIBRATION,
    mat: (row.mat as unknown as Project['mat'] | null) ?? null,
    annotations: (row.annotations as unknown as Annotation[] | null) ?? [],
    viewCount: row.view_count,
    publishedAt: row.published_at,
  };
}

/** Camel-case patch → row update (only the keys present). */
export function toRowUpdate(
  patch: Partial<
    Pick<
      StudioProject,
      | 'title'
      | 'description'
      | 'status'
      | 'geometryVersion'
      | 'model'
      | 'objectToMat'
      | 'calibration'
      | 'mat'
      | 'annotations'
    >
  >,
): ProjectUpdate {
  const u: ProjectUpdate = {};
  if (patch.title !== undefined) u.title = patch.title;
  if (patch.description !== undefined) u.description = patch.description ?? null;
  if (patch.status !== undefined) u.status = patch.status;
  if (patch.geometryVersion !== undefined) u.geometry_version = patch.geometryVersion;
  if (patch.model !== undefined) u.model = patch.model as unknown as Json;
  if (patch.objectToMat !== undefined) u.object_to_mat = patch.objectToMat as unknown as Json;
  if (patch.calibration !== undefined) u.calibration = patch.calibration as unknown as Json;
  if (patch.mat !== undefined) u.mat = patch.mat as unknown as Json;
  if (patch.annotations !== undefined) u.annotations = patch.annotations as unknown as Json;
  return u;
}

/** A complete Project (ready for the Viewer), or null while geometry/mat are missing. */
export function toProject(p: StudioProject): Project | null {
  if (!p.model || !p.objectToMat || !p.mat) return null;
  return { ...p, model: p.model, objectToMat: p.objectToMat, mat: p.mat };
}
