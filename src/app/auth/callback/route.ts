import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerDb } from '@/lib/db/server';

/** Magic-link landing: exchange the code (PKCE) or verify the token hash, then continue. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('next'));
  const db = await getServerDb();
  if (!db) return NextResponse.redirect(`${origin}/login?error=not-configured`);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const { error } = code
    ? await db.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await db.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing code') };
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

/** Only same-site relative paths. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/studio';
}
