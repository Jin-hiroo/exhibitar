'use client';

import { useEffect, useRef } from 'react';

/**
 * The width of the figure's `[data-measure]` element in the page's own
 * centimetres (the rulers' CSS cm), kept current as the layout changes, so the
 * dimension line always agrees with the rulers.
 */
export function MeasuredWidth() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const label = ref.current;
    const target = label?.closest('figure')?.querySelector<HTMLElement>('[data-measure]');
    const probe = document.querySelector<HTMLElement>('[data-cm-probe]');
    if (!label || !target || !probe) return;
    const update = () => {
      const cm = probe.offsetWidth || 37.8;
      // offsetWidth ignores the print's rotation: it is the sheet's own width
      label.textContent = `${(target.offsetWidth / cm).toFixed(1)} cm`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <span ref={ref} aria-hidden />;
}
