import 'server-only';
import { cache } from 'react';
import mockProject from '../../../tests/fixtures/project.mock.json';
import type { Project, ViewerProject } from '../types';
import { storagePublicBase } from './env';
import { getPublicDb } from './server';

/** Bundled demo exhibits (assets in public/fixtures/), served without a database. */
const FIXTURES: Record<string, Project> = {
  [mockProject.id]: mockProject as unknown as Project,
};

export interface PublishedExhibit {
  project: ViewerProject;
  /** base URL that the project's storage paths are relative to */
  assetBase: string;
}

/**
 * A published project for the public Viewer: demo fixtures first, then Supabase.
 * Cached per request: `generateMetadata` and the page share one database call.
 */
export const getPublishedProject = cache(async (id: string): Promise<PublishedExhibit | null> => {
  const fixture = FIXTURES[id];
  if (fixture) {
    const { title, description, model, objectToMat, calibration, mat, annotations } = fixture;
    return {
      project: { id, title, description, model, objectToMat, calibration, mat, annotations },
      assetBase: '/',
    };
  }
  const db = getPublicDb();
  const base = storagePublicBase();
  if (!db || !base || !/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  const { data, error } = await db.rpc('get_published_project', { p_id: id });
  if (error || !data) return null;
  return { project: data as unknown as ViewerProject, assetBase: base };
});
