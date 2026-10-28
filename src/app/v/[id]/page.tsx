import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import { ViewerApp } from '@/components/viewer/ViewerApp';
import { resolveAsset } from '@/lib/ar/asset-url';
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
  // start downloading the model and tracking images with the HTML, in parallel with the JS
  const { project, assetBase } = found;
  for (const path of [
    project.model.glbPath,
    ...(project.mat.markers ?? []).map((m) => m.imagePath),
    project.mat.trackImage?.imagePath,
  ]) {
    if (path) preload(resolveAsset(assetBase, path), { as: 'fetch', crossOrigin: 'anonymous' });
  }
  return <ViewerApp project={project} assetBase={assetBase} />;
}
