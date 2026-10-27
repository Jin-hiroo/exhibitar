import { nanoid } from 'nanoid';
import { redirect } from 'next/navigation';
import { Editor } from '@/components/studio/Editor';
import { newStudioProject } from '@/components/studio/draft';
import { supabaseEnv } from '@/lib/db/env';
import { getCurrentUser } from '@/lib/db/server';

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  // Starting an exhibit needs an account. A copy with no Supabase (local dev, self-hosting
  // without a backend) has no way to sign in, so there the Studio stays an in-tab draft.
  if (!user && supabaseEnv()) redirect(`/studio?next=${encodeURIComponent('/studio/new')}`);
  const project = newStudioProject(nanoid(10), user?.id ?? '');
  return <Editor initial={project} isNew signedIn={!!user} />;
}
