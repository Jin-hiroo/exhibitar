import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ViewerApp } from '@/components/viewer/ViewerApp';
import { getPublishedProject } from '@/lib/db/published';

export async function generateMetadata(props: PageProps<'/v/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const found = await getPublishedProject(id);
  return {
    title: found ? `${found.project.title} · ExhibitAR` : 'Exhibit not found · ExhibitAR',
    description: found?.project.description,
  };
}

export default async function ViewerPage(props: PageProps<'/v/[id]'>) {
  const { id } = await props.params;
  const found = await getPublishedProject(id);
  if (!found) notFound();
  return <ViewerApp project={found.project} assetBase={found.assetBase} />;
}
