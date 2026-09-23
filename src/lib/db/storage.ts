import type { Db } from './client';

export type Bucket = 'models' | 'mats' | 'annotation-media';

/**
 * Storage paths are "<bucket>/<projectId>/<file>" and are what `Project`
 * stores (glbPath, svgPath, imagePath). File names carry the geometry version,
 * so published assets are immutable and can be cached forever.
 */
export function assetPath(bucket: Bucket, projectId: string, file: string): string {
  return `${bucket}/${projectId}/${file}`;
}

export async function uploadAsset(
  db: Db,
  path: string,
  data: Blob | Uint8Array | string,
  contentType: string,
): Promise<void> {
  const [bucket, ...rest] = path.split('/');
  const body =
    typeof data === 'string'
      ? new Blob([data], { type: contentType })
      : data instanceof Uint8Array
        ? new Blob([new Uint8Array(data)], { type: contentType })
        : data;
  const { error } = await db.storage
    .from(bucket!)
    .upload(rest.join('/'), body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}
