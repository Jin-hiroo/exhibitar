import { notFound, redirect } from 'next/navigation';
import { Editor } from '@/components/studio/Editor';
import { getMyProject } from '@/lib/db/projects';
import { getCurrentUser, getServerDb } from '@/lib/db/server';

export default async function ProjectEditorPage(props: PageProps<'/studio/[id]'>) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/studio/${encodeURIComponent(id)}`);
  const db = await getServerDb();
  const project = db ? await getMyProject(db, id).catch(() => null) : null;
  if (!project) notFound();
  return <Editor initial={project} isNew={false} signedIn />;
}
