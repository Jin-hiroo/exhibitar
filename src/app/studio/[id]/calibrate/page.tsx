import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalibrateApp } from '@/components/viewer/CalibrateApp';
import { toProject } from '@/lib/db/mapping';
import { storagePublicBase } from '@/lib/db/env';
import { getMyProject } from '@/lib/db/projects';
import { getCurrentUser, getServerDb } from '@/lib/db/server';

/** D5: the owner aligns the virtual model with the real object on a phone. */
export default async function CalibratePage(props: PageProps<'/studio/[id]/calibrate'>) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/studio/${encodeURIComponent(id)}/calibrate`);
  const db = await getServerDb();
  const project = db ? await getMyProject(db, id).catch(() => null) : null;
  if (!project) notFound();
  const full = toProject(project);
  const base = storagePublicBase();
  if (!full || !full.model.glbPath || !base) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Calibrate {project.title}</h1>
        <p>Publish the exhibit first (it needs a stored model and mat).</p>
        <Link href={`/studio/${id}`}>Back to the Studio</Link>
      </main>
    );
  }
  const { title, description, model, objectToMat, calibration, mat, annotations } = full;
  return (
    <CalibrateApp
      project={{ id, title, description, model, objectToMat, calibration, mat, annotations }}
      assetBase={base}
    />
  );
}
