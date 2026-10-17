/**
 * Helpers for the `Server-Timing` response header. Browsers show it per request
 * in DevTools (Network → a request → Timing) and expose it to scripts as
 * `PerformanceResourceTiming.serverTiming`.
 */

export interface TimingEntry {
  /** metric name: a header token such as `auth` */
  name: string;
  /** duration in milliseconds */
  dur?: number;
  desc?: string;
}

export function serverTimingHeader(entries: readonly TimingEntry[]): string {
  return entries
    .map(({ name, dur, desc }) => {
      let s = name;
      if (dur !== undefined) s += `;dur=${dur.toFixed(1)}`;
      // quoted-string: drop characters that would end or escape it
      if (desc) s += `;desc="${desc.replace(/["\\\u0000-\u001f\u007f]/g, '')}"`;
      return s;
    })
    .join(', ');
}

/** The Vercel region that ran this function (e.g. `hnd1`), when deployed on Vercel. */
export function regionTiming(): TimingEntry[] {
  const region = process.env.VERCEL_REGION;
  return region ? [{ name: 'region', desc: region }] : [];
}
