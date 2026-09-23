import type { Db } from './client';
import { rowToStudioProject, toRowUpdate, type StudioProject } from './mapping';

// ---- Studio (runs with the signed-in user's client; RLS enforces ownership) ----

export interface ProjectSummary {
  id: string;
  title: string;
  status: 'draft' | 'published';
  updatedAt: string;
  viewCount: number;
}

export async function listMyProjects(db: Db): Promise<ProjectSummary[]> {
  const { data, error } = await db
    .from('projects')
    .select('id, title, status, updated_at, view_count')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status === 'published' ? 'published' : 'draft',
    updatedAt: r.updated_at,
    viewCount: r.view_count,
  }));
}

export async function getMyProject(db: Db, id: string): Promise<StudioProject | null> {
  const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToStudioProject(data) : null;
}

export async function createProject(
  db: Db,
  { id, title }: { id: string; title: string },
): Promise<StudioProject> {
  const { data, error } = await db.from('projects').insert({ id, title }).select('*').single();
  if (error) throw new Error(error.message);
  return rowToStudioProject(data);
}

export async function saveProject(
  db: Db,
  id: string,
  patch: Parameters<typeof toRowUpdate>[0],
): Promise<StudioProject> {
  const { data, error } = await db
    .from('projects')
    .update(toRowUpdate(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToStudioProject(data);
}

export async function deleteProject(db: Db, id: string): Promise<void> {
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
