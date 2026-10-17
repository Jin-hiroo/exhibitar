/**
 * Client-side navigation signals, set from instrumentation-client.ts: a
 * `nav-start` User Timing mark (NavTiming turns it into a measure) and a
 * `nav-start` window event (NavProgress shows a bar on slow navigations).
 */

export const NAV_START = 'nav-start';

export interface NavStart {
  from: string;
  to: string;
}

export function markNavigationStart(url: string): void {
  const detail: NavStart = { from: location.pathname, to: new URL(url, location.href).pathname };
  performance.clearMarks(NAV_START);
  performance.mark(NAV_START, { detail });
  window.dispatchEvent(new CustomEvent(NAV_START, { detail }));
}

/** The last navigation's start mark, if it led to `pathname`. */
export function navigationStartFor(pathname: string): PerformanceMark | undefined {
  const mark = performance.getEntriesByName(NAV_START, 'mark').at(-1) as
    PerformanceMark | undefined;
  return (mark?.detail as NavStart | undefined)?.to === pathname ? mark : undefined;
}

/** Console logging: on in development, or in any build after `localStorage.perf = '1'`. */
export function perfLogEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  try {
    return localStorage.getItem('perf') === '1';
  } catch {
    return false;
  }
}
