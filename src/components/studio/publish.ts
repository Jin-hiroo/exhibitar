import type { Db } from '@/lib/db/client';
import type { StudioProject } from '@/lib/db/mapping';
import { createProject, getMyProject, saveProject } from '@/lib/db/projects';
import { assetPath, uploadAsset } from '@/lib/db/storage';
import type { Project } from '@/lib/types';
import type { PreparedSession } from './Editor';

export type ProgressFn = (message: string, fraction: number) => void;

/** A new mat to upload, with the model it was made for — or without one when a stored mat is rebuilt. */
export type NewGeometry = Pick<PreparedSession, 'mat' | 'geometryVersion'> &
  Partial<Pick<PreparedSession, 'prepared'>>;

const MEDIA_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

/**
 * Save (and optionally publish) a project: create the row if needed, upload
 * the frozen GLB (if new) + mat assets when there is new geometry, then write the row.
 * Only the simplified GLB, mat files and marker images are uploaded — never
 * the STL (CLAUDE.md core idea #2).
 */
export async function saveToCloud(
  db: Db,
  project: StudioProject,
  ready: NewGeometry | null,
  status: 'draft' | 'published',
  onProgress: ProgressFn,
  media: Record<string, File> = {},
): Promise<StudioProject> {
  const { id } = project;
  // validate everything before writing anything
  for (const file of Object.values(media)) {
    if (!MEDIA_TYPES[file.type]) throw new Error(`${file.name}: use a PNG, JPEG or WebP image.`);
    if (file.size > MAX_MEDIA_BYTES) throw new Error(`${file.name}: images must be under 5 MB.`);
  }
  onProgress('Saving…', 0.02);
  if (!(await getMyProject(db, id))) {
    await createProject(db, { id, title: project.title });
  }

  let geometry:
    | (Pick<Project, 'mat' | 'geometryVersion'> & Partial<Pick<Project, 'model' | 'objectToMat'>>)
    | null = null;
  if (ready) {
    const gv = ready.geometryVersion;
    const { prepared, mat } = ready;
    const glbPath = assetPath('models', id, `model-v${gv}.glb`);
    const svgPath = assetPath('mats', id, `mat-v${gv}.svg`);
    const uploads: [string, Uint8Array | string, string][] = [
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
    // a rebuilt mat keeps the stored GLB (never re-simplified: CLAUDE.md core idea #3)
    if (prepared) uploads.unshift([glbPath, prepared.glb, 'model/gltf-binary']);
    for (const [i, [path, data, type]] of uploads.entries()) {
      onProgress(`Uploading ${path.split('/').pop()}…`, 0.05 + (0.8 * i) / uploads.length);
      await uploadAsset(db, path, data, type);
    }
    geometry = {
      geometryVersion: gv,
      ...(prepared && {
        model: {
          glbPath,
          triangleCount: prepared.triangleCount,
          boundsMm: { size: prepared.boundsMm.size },
          sourceScale: project.model?.sourceScale ?? 1,
        },
        objectToMat: prepared.objectToMat,
      }),
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

  // annotation images chosen in the Studio
  let annotations = project.annotations;
  for (const [annId, file] of Object.entries(media)) {
    if (!annotations.some((a) => a.id === annId)) continue; // annotation was deleted
    const ext = MEDIA_TYPES[file.type]!;
    const path = assetPath('annotation-media', id, `${annId}-${Date.now().toString(36)}.${ext}`);
    onProgress(`Uploading ${file.name}…`, 0.87);
    await uploadAsset(db, path, file, file.type);
    annotations = annotations.map((a) => (a.id === annId ? { ...a, imagePath: path } : a));
  }

  if (status === 'published' && !(geometry?.model ?? project.model?.glbPath)) {
    throw new Error('Generate the model and mat (Setup) before publishing.');
  }
  onProgress('Saving the exhibit…', 0.9);
  const saved = await saveProject(db, id, {
    title: project.title,
    description: project.description,
    annotations,
    status,
    ...(geometry ?? {}),
  });
  onProgress('Done', 1);
  return saved;
}
