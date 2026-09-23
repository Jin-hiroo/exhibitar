import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ViewerApp } from '@/components/viewer/ViewerApp';
import { assetBaseUrl, getPublishedProject } from '@/lib/db/projects';

export async function generateMetadata(props: PageProps<'/v/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getPublishedProject(id);
  return { title: project ? `${project.title} · ExhibitAR` : 'Exhibit not found · ExhibitAR' };
}

export default async function ViewerPage(props: PageProps<'/v/[id]'>) {
  const { id } = await props.params;
  const project = await getPublishedProject(id);
  if (!project) notFound();
  return <ViewerApp project={project} assetBase={assetBaseUrl()} />;
}
