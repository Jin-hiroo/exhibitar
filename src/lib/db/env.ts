/** Public Supabase settings (safe to expose: RLS protects the data). */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/**
 * Canonical public origin for Viewer links and QR codes (never a preview URL).
 * Set NEXT_PUBLIC_SITE_URL to your production domain, even in local dev: a
 * printed mat must scan from any phone. On Vercel it falls back to the
 * project's production domain (set even in preview deployments).
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

/** Public URL prefix for storage paths like "models/<id>/model-v2.glb". */
export function storagePublicBase(): string | null {
  const env = supabaseEnv();
  return env ? `${env.url}/storage/v1/object/public` : null;
}
