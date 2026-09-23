-- ExhibitAR: projects, public viewer access, view counts, storage (WS-E, E2/E3/E5).
-- See docs/ARCHITECTURE.md §3. JSON columns hold the camelCase shapes from src/lib/types.ts.

create table public.projects (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,32}$'),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  description text check (char_length(description) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  geometry_version integer not null default 1 check (geometry_version >= 1),
  model jsonb,
  object_to_mat jsonb,
  calibration jsonb not null default '{"dxMm":0,"dyMm":0,"dzMm":0,"yawDeg":0}'::jsonb,
  mat jsonb,
  annotations jsonb not null default '[]'::jsonb,
  view_count bigint not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

alter table public.projects enable row level security;

create policy "Owners can read their projects" on public.projects
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners can create projects" on public.projects
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners can update their projects" on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their projects" on public.projects
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Bookkeeping on update:
-- * id and owner never change
-- * updated_at moves on real edits (not on view counting)
-- * geometry_version only grows, and must grow when the model or its placement changes
--   (a new geometry means a new mat; the Studio bumps it before generating the mat)
-- * published_at is stamped when a project is first published
create function public.projects_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.owner_id := old.owner_id;
  if (to_jsonb(new) - 'view_count' - 'updated_at') is distinct from
     (to_jsonb(old) - 'view_count' - 'updated_at') then
    new.updated_at := now();
  end if;
  if new.geometry_version < old.geometry_version then
    new.geometry_version := old.geometry_version;
  end if;
  if (new.model is distinct from old.model or new.object_to_mat is distinct from old.object_to_mat)
     and new.geometry_version = old.geometry_version then
    new.geometry_version := old.geometry_version + 1;
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger projects_before_update
  before update on public.projects
  for each row execute function public.projects_before_update();

-- Public Viewer access: only published projects, only Viewer fields (ViewerProject).
create function public.get_published_project(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'model', p.model,
    'objectToMat', p.object_to_mat,
    'calibration', p.calibration,
    'mat', p.mat,
    'annotations', p.annotations,
    'updatedAt', p.updated_at
  )
  from public.projects p
  where p.id = p_id and p.status = 'published';
$$;

revoke all on function public.get_published_project(text) from public;
grant execute on function public.get_published_project(text) to anon, authenticated;

-- Simple view counter (E5).
create function public.record_view(p_id text) returns void
language sql volatile security definer set search_path = '' as $$
  update public.projects set view_count = view_count + 1
  where id = p_id and status = 'published';
$$;

revoke all on function public.record_view(text) from public;
grant execute on function public.record_view(text) to anon, authenticated;

-- Storage (E3): public-read buckets; objects live under "<projectId>/…" and
-- only that project's owner may write them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('models', 'models', true, 5242880, array['model/gltf-binary', 'application/octet-stream']),
  ('mats', 'mats', true, 20971520, array['image/svg+xml', 'application/pdf', 'image/png']),
  ('annotation-media', 'annotation-media', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp']);

create function public.owns_project_folder(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = (storage.foldername(object_name))[1]
      and p.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_project_folder(text) from public;
grant execute on function public.owns_project_folder(text) to authenticated;

create policy "Owners upload project assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('models', 'mats', 'annotation-media') and public.owns_project_folder(name)
  );
create policy "Owners replace project assets" on storage.objects
  for update to authenticated
  using (bucket_id in ('models', 'mats', 'annotation-media') and public.owns_project_folder(name));
create policy "Owners delete project assets" on storage.objects
  for delete to authenticated
  using (bucket_id in ('models', 'mats', 'annotation-media') and public.owns_project_folder(name));
-- upsert needs to see the existing object
create policy "Owners read project assets" on storage.objects
  for select to authenticated
  using (bucket_id in ('models', 'mats', 'annotation-media') and public.owns_project_folder(name));
