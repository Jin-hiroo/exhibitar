import type { Db } from '@/lib/db/client';
import type { StudioProject } from '@/lib/db/mapping';
import { createProject, getMyProject, saveProject } from '@/lib/db/projects';
import { assetPath, uploadAsset } from '@/lib/db/storage';
import type { Project } from '@/lib/types';
import type { PreparedSession } from './Editor';

export type ProgressFn = (message: string, fraction: number) => void;

/**
 * Save (and optionally publish) a project: create the row if needed, upload
 * the frozen GLB + mat assets when there is new geometry, then write the row.
 * Only the simplified GLB, mat files and marker images are uploaded — never
 * the STL (CLAUDE.md core idea #2).
 */
export async function saveToCloud(
  db: Db,
  project: StudioProject,
  ready: PreparedSession | null,
  status: 'draft' | 'published',
  onProgress: ProgressFn,
): Promise<StudioProject> {
  const { id } = project;
  onProgress('Saving…', 0.02);
  if (!(await getMyProject(db, id))) {
    await createProject(db, { id, title: project.title });
  }

  let geometry: Pick<Project, 'model' | 'objectToMat' | 'mat' | 'geometryVersion'> | null = null;
  if (ready) {
    const gv = ready.geometryVersion;
    const { prepared, mat } = ready;
    const glbPath = assetPath('models', id, `model-v${gv}.glb`);
    const svgPath = assetPath('mats', id, `mat-v${gv}.svg`);
    const uploads: [string, Uint8Array | string, string][] = [
      [glbPath, prepared.glb, 'model/gltf-binary'],
      [svgPath, mat.svg, 'image/svg+xml'],
      [assetPath('mats', id, `mat-v${gv}.pdf`), mat.pdf, 'application/pdf'],
      [assetPath('mats', id, `qr-v${gv}.png`), mat.qrPng, 'image/png'],
      [assetPath('mats', id, `track-v${gv}.png`), mat.trackPng, 'image/png'],
      ...mat.markerPngs.map((m): [string, Uint8Array, string] => [
        assetPath('mats', id, `marker-v${gv}-${m.id}.png`),
        m.png,
        'image/png',
      ]),
    ];
    for (const [i, [path, data, type]] of uploads.entries()) {
      onProgress(`Uploading ${path.split('/').pop()}…`, 0.05 + (0.8 * i) / uploads.length);
      await uploadAsset(db, path, data, type);
    }
    geometry = {
      geometryVersion: gv,
      model: {
        glbPath,
        triangleCount: prepared.triangleCount,
        boundsMm: { size: prepared.boundsMm.size },
        sourceScale: project.model?.sourceScale ?? 1,
      },
      objectToMat: prepared.objectToMat,
      mat: {
        ...mat.meta,
        svgPath,
        markers: mat.meta.markers.map((m) => ({
          ...m,
          imagePath: assetPath('mats', id, `marker-v${gv}-${m.id}.png`),
        })),
        trackImage: {
          ...mat.meta.trackImage,
          imagePath: assetPath('mats', id, `track-v${gv}.png`),
        },
      },
    };
  }

  if (status === 'published' && !(geometry?.model ?? project.model?.glbPath)) {
    throw new Error('Generate the model and mat (Setup) before publishing.');
  }
  onProgress('Saving the exhibit…', 0.9);
  const saved = await saveProject(db, id, {
    title: project.title,
    description: project.description,
    annotations: project.annotations,
    status,
    ...(geometry ?? {}),
  });
  onProgress('Done', 1);
  return saved;
}
