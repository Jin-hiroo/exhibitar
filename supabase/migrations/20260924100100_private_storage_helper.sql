-- Storage-policy helper must not be callable through the REST API: move it to a
-- private (non-exposed) schema. Policies still run it as the signed-in user.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.owns_project_folder(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = (storage.foldername(object_name))[1]
      and p.owner_id = (select auth.uid())
  );
$$;
revoke all on function private.owns_project_folder(text) from public, anon;
grant execute on function private.owns_project_folder(text) to authenticated;

drop policy "Owners upload project assets" on storage.objects;
drop policy "Owners replace project assets" on storage.objects;
drop policy "Owners delete project assets" on storage.objects;
drop policy "Owners read project assets" on storage.objects;
drop function public.owns_project_folder(text);

create policy "Owners upload project assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('models', 'mats', 'annotation-media') and private.owns_project_folder(name)
  );
create policy "Owners replace project assets" on storage.objects
  for update to authenticated
  using (bucket_id in ('models', 'mats', 'annotation-media') and private.owns_project_folder(name));
create policy "Owners delete project assets" on storage.objects
  for delete to authenticated
  using (bucket_id in ('models', 'mats', 'annotation-media') and private.owns_project_folder(name));
create policy "Owners read project assets" on storage.objects
  for select to authenticated
  using (bucket_id in ('models', 'mats', 'annotation-media') and private.owns_project_folder(name));
