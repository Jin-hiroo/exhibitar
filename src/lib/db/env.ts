/** Public Supabase settings (safe to expose: RLS protects the data). */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** Canonical public origin for Viewer links and QR codes (never a preview URL). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/** Public URL prefix for storage paths like "models/<id>/model-v2.glb". */
export function storagePublicBase(): string | null {
  const env = supabaseEnv();
  return env ? `${env.url}/storage/v1/object/public` : null;
}
