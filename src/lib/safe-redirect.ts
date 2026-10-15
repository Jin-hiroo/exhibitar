/**
 * Where to send the user after signing in, from an untrusted `?next=` value.
 *
 * Only same-site paths pass. A plain `startsWith('/')` check is not enough:
 * browsers treat `//evil.example` and `/\evil.example` as other hosts, which
 * would make the login page an open redirect.
 */
export function safeNextPath(raw: unknown, fallback = '/studio'): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return fallback;
  // reject control characters: URL parsing silently strips tabs and newlines
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return fallback;
  }
  const base = 'https://same-site.invalid';
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
