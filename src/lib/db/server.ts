import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { timedFetch } from '../perf/timed-fetch';
import { signedInWithGoogle } from './auth-method';
import type { Db } from './client';
import type { Database } from './database.types';
import { supabaseEnv } from './env';

/**
 * Supabase client for Server Components / Route Handlers, acting as the signed-in user.
 * One per request (React `cache`), shared by `getCurrentUser` and the page's queries.
 */
export const getServerDb = cache(async (): Promise<Db | null> => {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    global: { fetch: timedFetch() },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a Server Component: the proxy refreshes the session instead
        }
      },
    },
  });
});

/** Anonymous client (no cookies): public data such as published projects. */
export function getPublicDb(): Db | null {
  const env = supabaseEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.key, {
    auth: { persistSession: false },
    global: { fetch: timedFetch() },
  });
}

/**
 * Whether the Google provider is switched on in Supabase (Auth → Sign In / Providers), from
 * the project's public auth settings. Cached for 5 minutes: the login page shows "Continue
 * with Google" soon after the provider is enabled, without a redeploy.
 */
export async function isGoogleSignInEnabled(): Promise<boolean> {
  const env = supabaseEnv();
  if (!env) return false;
  try {
    const res = await timedFetch()(`${env.url}/auth/v1/settings`, {
      headers: { apikey: env.key },
      next: { revalidate: 300 },
      // an optional button: never hold the sign-in page on a slow auth server
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: unknown } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

/**
 * The signed-in user, from the session's access token. `getClaims` checks the
 * token's signature locally against the project's public signing keys (fetched
 * once and cached), so a page doesn't wait for a round trip to Supabase Auth.
 * Data access is still authorized by RLS in the database.
 */
export const getCurrentUser = cache(
  async (): Promise<{ id: string; email: string | null; google: boolean } | null> => {
    const db = await getServerDb();
    if (!db) return null;
    const { data } = await db.auth.getClaims();
    const claims = data?.claims;
    return claims
      ? { id: claims.sub, email: claims.email ?? null, google: signedInWithGoogle(claims.amr) }
      : null;
  },
);
