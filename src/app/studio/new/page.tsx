import { nanoid } from 'nanoid';
import { Editor } from '@/components/studio/Editor';
import { newStudioProject } from '@/components/studio/draft';
import { getCurrentUser } from '@/lib/db/server';

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  const project = newStudioProject(nanoid(10), user?.id ?? '');
  return <Editor initial={project} isNew signedIn={!!user} />;
}
