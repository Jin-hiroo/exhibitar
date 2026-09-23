/** Project storage path → URL (absolute URLs pass through). Dependency-free for server use. */
export function resolveAsset(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
