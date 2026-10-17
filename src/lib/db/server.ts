import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { timedFetch } from '../perf/timed-fetch';
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
 * The signed-in user, from the session's access token. `getClaims` checks the
 * token's signature locally against the project's public signing keys (fetched
 * once and cached), so a page doesn't wait for a round trip to Supabase Auth.
 * Data access is still authorized by RLS in the database.
 */
export const getCurrentUser = cache(
  async (): Promise<{ id: string; email: string | null } | null> => {
    const db = await getServerDb();
    if (!db) return null;
    const { data } = await db.auth.getClaims();
    const claims = data?.claims;
    return claims ? { id: claims.sub, email: claims.email ?? null } : null;
  },
);
