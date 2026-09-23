import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabaseEnv } from './env';

export type Db = SupabaseClient<Database>;

let browserClient: Db | null = null;

/** Supabase client for Client Components (session in cookies, shared with the server). */
export function getBrowserDb(): Db | null {
  if (browserClient) return browserClient;
  const env = supabaseEnv();
  if (!env) return null;
  browserClient = createBrowserClient<Database>(env.url, env.key);
  return browserClient;
}
