'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV_START, type NavStart } from './nav-timing';
import styles from './nav-progress.module.css';

/** Fast navigations finish before the bar appears, so they don't flicker. */
const SHOW_AFTER_MS = 150;
/** Gives up on navigations that never land (e.g. a failed request). */
const GIVE_UP_AFTER_MS = 20_000;

/**
 * A thin bar at the top of the window while a navigation is slow, e.g. on a
 * cold server. (A loading.tsx state would also give feedback, but React then
 * holds the real page back for at least 300 ms, slowing every navigation.)
 */
export function NavProgress() {
  const pathname = usePathname();
  const [slow, setSlow] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // the navigation is over once the new pathname is on screen
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setSlow(false);
  }
  useEffect(() => {
    const list = timers.current;
    return () => list.splice(0).forEach(clearTimeout);
  }, [pathname]);

  useEffect(() => {
    const list = timers.current;
    const onStart = (e: Event) => {
      const { from, to } = (e as CustomEvent<NavStart>).detail;
      list.splice(0).forEach(clearTimeout);
      if (to === from) return; // same page (e.g. only the query changes)
      // State is only set from timers: this handler runs inside the router's
      // transition, and an update made there would only land with the new page.
      list.push(
        setTimeout(() => location.pathname === from && setSlow(true), SHOW_AFTER_MS),
        setTimeout(() => setSlow(false), GIVE_UP_AFTER_MS),
      );
    };
    window.addEventListener(NAV_START, onStart);
    return () => window.removeEventListener(NAV_START, onStart);
  }, []);

  return slow ? <div className={styles.bar} aria-hidden /> : null;
}
