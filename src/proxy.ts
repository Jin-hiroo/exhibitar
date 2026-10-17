import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { regionTiming, serverTimingHeader } from '@/lib/perf/server-timing';
import { timedFetch } from '@/lib/perf/timed-fetch';

/**
 * Keeps the Supabase session cookie fresh for the Studio and auth routes.
 * Authorization itself happens in the pages (RLS in the database).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    global: { fetch: timedFetch() },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Refreshes the access token if needed (must run before the response is returned).
  // The signature is checked locally against the cached signing keys, so this
  // only calls Supabase Auth when the token has to be refreshed.
  const t0 = performance.now();
  await supabase.auth.getClaims();
  response.headers.set(
    'Server-Timing',
    serverTimingHeader([
      { name: 'auth', dur: performance.now() - t0, desc: 'session check' },
      ...regionTiming(),
    ]),
  );
  return response;
}

export const config = {
  matcher: ['/studio/:path*', '/login', '/auth/:path*'],
};
