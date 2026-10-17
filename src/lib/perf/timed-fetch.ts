/**
 * Logs slow Supabase calls made by the server (proxy, Server Components, Route
 * Handlers). The lines start with `[perf]`: search for it in Vercel → Logs or
 * in the `pnpm dev` terminal. Set `PERF_LOG=1` to log every call.
 *
 * Only the method, service and path are logged: never query strings, headers
 * or bodies.
 */

/** Calls at least this slow are always logged. */
export const SLOW_SUPABASE_CALL_MS = 300;

/** "auth GET /user", "rest GET projects", "rpc get_published_project", "storage GET" */
export function describeSupabaseCall(method: string, url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return `${method} (invalid URL)`;
  }
  const rpc = path.match(/^\/rest\/v1\/rpc\/([^/]+)/);
  if (rpc) return `rpc ${rpc[1]}`;
  const rest = path.match(/^\/rest\/v1\/([^/]+)/);
  if (rest) return `rest ${method} ${rest[1]}`;
  const auth = path.match(/^\/auth\/v1(\/.*)$/);
  if (auth) return `auth ${method} ${auth[1]}`;
  if (path.startsWith('/storage/')) return `storage ${method}`;
  return `${method} ${path}`;
}

/** `fetch` for Supabase clients that times each call (until the response headers arrive). */
export function timedFetch(): typeof fetch {
  return async (input, init) => {
    const t0 = performance.now();
    try {
      return await fetch(input, init);
    } finally {
      const ms = performance.now() - t0;
      if (ms >= SLOW_SUPABASE_CALL_MS || process.env.PERF_LOG === '1') {
        const req = input instanceof Request ? input : null;
        const method = init?.method ?? req?.method ?? 'GET';
        const url = req ? req.url : String(input);
        const region = process.env.VERCEL_REGION;
        console.warn(
          `[perf] supabase ${describeSupabaseCall(method, url)} ${Math.round(ms)} ms` +
            (region ? ` (function region ${region})` : ''),
        );
      }
    }
  };
}
