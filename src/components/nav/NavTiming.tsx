'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { navigationStartFor, perfLogEnabled, type NavStart } from './nav-timing';

/**
 * Measures client-side navigations from the click until the new page is on
 * screen, as `nav → /path` in DevTools → Performance → Timings. See
 * perfLogEnabled for the `[perf]` console lines.
 */
export function NavTiming() {
  const pathname = usePathname();
  useEffect(() => {
    const start = navigationStartFor(pathname);
    if (!start) return;
    performance.clearMarks(start.name);
    const { duration } = performance.measure(`nav → ${pathname}`, { start: start.startTime });
    if (perfLogEnabled()) {
      const { from } = start.detail as NavStart;
      console.info(`[perf] nav ${from} → ${pathname}: ${Math.round(duration)} ms`);
    }
  }, [pathname]);
  return null;
}
