import { NextResponse, type NextRequest } from 'next/server';
import { getServerDb } from '@/lib/db/server';
import { safeNextPath } from '@/lib/safe-redirect';

/**
 * Google sign-in landing. Supabase sends the browser here with a one-time `code` (PKCE),
 * exchanged for the session cookie before continuing to `next`. On failure, back to the
 * login page with an error code, which it shows as a fixed message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'));
  const backToLogin = (error: string) =>
    NextResponse.redirect(`${origin}/login?${new URLSearchParams({ error, next })}`);

  const code = searchParams.get('code');
  // cancelled at Google, sign-ups disabled, …: `error_code` is the specific reason
  if (!code) {
    return backToLogin(searchParams.get('error_code') || searchParams.get('error') || 'no_code');
  }
  const db = await getServerDb();
  if (!db) return backToLogin('not_configured');
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return backToLogin(error.code ?? 'exchange_failed');
  return NextResponse.redirect(`${origin}${next}`);
}
