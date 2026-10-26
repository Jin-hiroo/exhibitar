'use client';

import { useEffect } from 'react';

/**
 * Marks the contents entry of the section being read with `aria-current`: the last
 * section whose top has passed 30 % of the viewport, or the last one at the page's end.
 */
export function TocTracker({ navId }: { navId: string }) {
  useEffect(() => {
    const nav = document.getElementById(navId);
    if (!nav) return;
    const pairs = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).flatMap(
      (link) => {
        const section = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        return section ? [{ link, section }] : [];
      },
    );
    if (!pairs.length) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = -1;
      pairs.forEach(({ section }, i) => {
        if (section.getBoundingClientRect().top <= line) current = i;
      });
      if (atEnd && current >= 0) current = pairs.length - 1;
      pairs.forEach(({ link }, i) => {
        if (i === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [navId]);

  return null;
}
