'use client';

import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Expand } from './icons';
import styles from './landing.module.css';
import { T } from './T';

const noSubscription = () => () => {};

/**
 * The demo mat, with a button that fills the screen with it: bigger markers
 * track better, and on a laptop full screen comes close to the printed size.
 */
export function FullscreenMat({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const supported = useSyncExternalStore(
    noSubscription,
    () => document.fullscreenEnabled === true,
    () => false,
  );

  return (
    <div className={styles.demoMat}>
      <div ref={ref} className={styles.demoMatFrame}>
        {children}
      </div>
      {supported && (
        <button
          type="button"
          className={styles.textButton}
          onClick={() => ref.current?.requestFullscreen().catch(() => {})}
        >
          <Expand />
          <T en="Fill the screen" ja="全画面で表示" />
        </button>
      )}
    </div>
  );
}
