import type { AMREntry, JwtPayload } from '@supabase/supabase-js';

/**
 * Whether this session signed in through Google, from the access token's `amr` claim
 * (authentication methods, kept across token refreshes). Google is the only OAuth provider
 * the app offers, so an `oauth` entry means Google.
 */
export function signedInWithGoogle(amr: JwtPayload['amr']): boolean {
  const entries: (AMREntry | string)[] = amr ?? [];
  return entries.some((e) => (typeof e === 'string' ? e : e.method) === 'oauth');
}
