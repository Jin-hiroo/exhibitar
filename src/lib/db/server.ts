import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Db } from './client';
import type { Database } from './database.types';
import { supabaseEnv } from './env';

/** Supabase client for Server Components / Route Handlers, acting as the signed-in user. */
export async function getServerDb(): Promise<Db | null> {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.key, {
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
}

/** Anonymous client (no cookies): public data such as published projects. */
export function getPublicDb(): Db | null {
  const env = supabaseEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.key, { auth: { persistSession: false } });
}

export async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  const db = await getServerDb();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}
