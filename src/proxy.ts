import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the Supabase session cookie fresh for the Studio and auth routes, and
 * routes magic-link codes that land on the Site URL root to /auth/callback.
 * Authorization itself happens in the pages (RLS in the database).
 */
export async function proxy(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;
  if (pathname === '/' && (searchParams.has('code') || searchParams.has('token_hash'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // refreshes the access token if needed (must run before the response is returned)
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/', '/studio/:path*', '/login', '/auth/:path*'],
};
