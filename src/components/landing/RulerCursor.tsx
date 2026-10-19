'use client';

import { useEffect, useRef } from 'react';
import styles from './landing.module.css';

/**
 * Yellow ticks on the top and left rulers that follow the pointer, like a set
 * square, with the reading in centimetres. Mouse and pen only.
 */
export function RulerCursor() {
  const topRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const topLabel = useRef<HTMLSpanElement>(null);
  const leftLabel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const top = topRef.current;
    const left = leftRef.current;
    const root = top?.closest<HTMLElement>('[data-landing]');
    if (!top || !left || !root || !window.matchMedia('(pointer: fine)').matches) return;

    // one centimetre and the ruler origin, as laid out (CSS cm, not physical)
    const probe = root.querySelector<HTMLElement>('[data-cm-probe]');
    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      const cm = probe?.getBoundingClientRect().width || 37.8;
      const box = root.getBoundingClientRect();
      const px = x - box.left;
      const py = y - box.top;
      top.style.transform = `translateX(${px}px)`;
      left.style.transform = `translateY(${py}px)`;
      if (topLabel.current) topLabel.current.textContent = Math.max(0, px / cm - 1).toFixed(1);
      if (leftLabel.current) leftLabel.current.textContent = Math.max(0, py / cm - 1).toFixed(1);
      root.setAttribute('data-pointer', '');
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => root.removeAttribute('data-pointer');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <>
      <div ref={topRef} className={styles.cursorTop} aria-hidden>
        <span ref={topLabel} />
      </div>
      <div ref={leftRef} className={styles.cursorLeft} aria-hidden>
        <span ref={leftLabel} />
      </div>
    </>
  );
}
