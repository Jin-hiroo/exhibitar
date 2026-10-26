import Link from 'next/link';
import styles from './landing.module.css';
import { LangSwitch } from './LangSwitch';
import { RulerCursor } from './RulerCursor';
import { T } from './T';

export const REPO = 'https://github.com/Jin-hiroo/exhibitar';
/** Bundled demo exhibit (public/fixtures), served without a database. */
export const DEMO_ID = 'mockcube01';

const TOP_NUMBERS = Array.from({ length: 80 }, (_, i) => i);
/** One text node, one number per centimetre line, long enough for the tallest layout. */
const LEFT_NUMBERS = Array.from({ length: 420 }, (_, i) => i).join('\n');

/**
 * The left ruler printed in ink down the paper, the 1 cm probe the readouts measure
 * against, and the pointer ticks. The mat covers the ruler's top with its own,
 * numbered the same, so the count never breaks.
 */
export function PaperRuler() {
  return (
    <>
      <div className={`${styles.rulerLeft} ${styles.rulerPaper}`} aria-hidden>
        <span className={styles.rulerLeftNumbers}>{LEFT_NUMBERS}</span>
      </div>
      <span className={styles.cmProbe} data-cm-probe="" aria-hidden />
      <RulerCursor />
    </>
  );
}

/** The cream rulers along the mat's top and left edges. */
export function MatRulers() {
  return (
    <>
      <div className={styles.rulerTop} aria-hidden>
        {TOP_NUMBERS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className={styles.rulerLeft} aria-hidden>
        <span className={styles.rulerLeftNumbers}>{LEFT_NUMBERS}</span>
      </div>
      <div className={styles.rulerCorner} aria-hidden>
        cm
      </div>
    </>
  );
}

/** Printed on the mat beneath the top ruler. On the home page its links stay in-page. */
export function SiteNav({ home = false }: { home?: boolean }) {
  const at = home ? '' : '/';
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.wordmark}>
        ExhibitAR
      </Link>
      <nav className={styles.navLinks} aria-label="Main">
        <a href={`${at}#how`}>
          <T en="How it works" ja="使い方" />
        </a>
        <a href={`${at}#demo`}>
          <T en="Demo" ja="デモ" />
        </a>
        <a href={REPO}>GitHub</a>
      </nav>
      <LangSwitch />
      <Link href="/studio" className={styles.navStudio}>
        <T en="Open Studio" ja="スタジオを開く" />
      </Link>
    </header>
  );
}

/** The two masking strips that tape the paper's top edge to the mat. */
export function EdgeStrips() {
  return (
    <>
      <span className={styles.edgeStrip} data-pos="l" aria-hidden />
      <span className={styles.edgeStrip} data-pos="r" aria-hidden />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className={`${styles.wrap} ${styles.footer}`}>
      <p className={styles.imprint}>
        ExhibitAR ·{' '}
        <T en="Placement mats for any 3D print" ja="あらゆる3Dプリントのための配置マット" />
      </p>
      <nav aria-label="Footer" className={styles.footerLinks}>
        <Link href="/studio">Studio</Link>
        <Link href={`/v/${DEMO_ID}`}>
          <T en="Demo" ja="デモ" />
        </Link>
        <a href={REPO}>GitHub</a>
        <a href={`${REPO}/blob/main/LICENSE`}>Apache 2.0</a>
        <Link href="/privacy">
          <T en="Privacy" ja="プライバシー" />
        </Link>
        <Link href="/terms">
          <T en="Terms" ja="利用規約" />
        </Link>
      </nav>
    </footer>
  );
}
