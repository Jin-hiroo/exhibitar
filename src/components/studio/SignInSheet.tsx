import Link from 'next/link';
import { LoginForm } from '@/app/login/LoginForm';
import { DEMO_ID, MatRulers, REPO } from '../landing/chrome';
import { displayFont, textFont } from '../landing/fonts';
import { ArrowRight } from '../landing/icons';
import landing from '../landing/landing.module.css';
import { RulerCursor } from '../landing/RulerCursor';
import styles from './sign-in.module.css';

/**
 * Signing in to the Studio (`/studio` signed out, and `/login`), in the landing page's
 * world: one paper sheet taped to the cutting mat, with the sign-in printed on it and
 * the three things an exhibit needs along its foot.
 */
export function SignInSheet({
  next,
  google,
  error,
  configured,
}: {
  next: string;
  /** the Google provider is enabled in Supabase */
  google: boolean;
  /** why the last Google sign-in failed */
  error: string | null;
  /** Supabase is set up; without it nobody can sign in and the Studio is an in-tab draft */
  configured: boolean;
}) {
  return (
    <div
      data-landing=""
      data-lang="en"
      lang="en"
      className={`${landing.root} ${styles.page} ${displayFont.variable} ${textFont.variable}`}
    >
      <span className={landing.cmProbe} data-cm-probe="" aria-hidden />
      <RulerCursor />
      <div className={`${landing.mat} ${styles.mat}`}>
        <MatRulers />
        <div className={`${landing.wrap} ${landing.matWrap} ${styles.matWrap}`}>
          <header className={landing.nav}>
            <Link href="/" className={landing.wordmark}>
              ExhibitAR
            </Link>
            <nav className={landing.navLinks} aria-label="Main">
              <Link href="/#how">How it works</Link>
              <Link href={`/v/${DEMO_ID}`}>Try the demo</Link>
            </nav>
            <Link href="/" className={landing.navStudio}>
              Home
            </Link>
          </header>

          <main className={styles.main}>
            <section className={styles.sheet} aria-labelledby="sign-in-title">
              <span className={`${landing.strip} ${styles.stripL}`} aria-hidden />
              <span className={`${landing.strip} ${styles.stripR}`} aria-hidden />

              {configured ? (
                <>
                  <h1 id="sign-in-title" className={styles.title}>
                    Sign in to the Studio
                  </h1>
                  <p className={styles.lede}>
                    Make exhibits, publish them, and come back to edit them.
                  </p>
                  <LoginForm next={next} google={google} error={error} />
                </>
              ) : (
                <>
                  <h1 id="sign-in-title" className={styles.title}>
                    Studio
                  </h1>
                  <p className={styles.lede}>
                    This copy of ExhibitAR has no sign-in set up, so an exhibit stays a draft in
                    your browser tab until you close it.
                  </p>
                  <Link href="/studio/new" className={styles.tape}>
                    <span className={styles.tapeFace}>
                      Start a draft <ArrowRight />
                    </span>
                  </Link>
                </>
              )}

              <ul className={styles.needs} aria-label="What an exhibit needs">
                <li>
                  <strong>An STL file</strong>
                  <span>Stays in your browser</span>
                </li>
                <li>
                  <strong>A print of it</strong>
                  <span>Stands on the mat</span>
                </li>
                <li>
                  <strong>A printer</strong>
                  <span>Office paper, at 100 %</span>
                </li>
              </ul>

              {configured && (
                <p className={styles.legal}>
                  By signing in or creating an account, you agree to the{' '}
                  <Link href="/terms">Terms of service</Link> and the{' '}
                  <Link href="/privacy">Privacy policy</Link>.
                </p>
              )}
            </section>
          </main>

          <footer className={styles.foot}>
            <p>
              Free and open source under <a href={`${REPO}/blob/main/LICENSE`}>Apache 2.0</a>.
            </p>
            {configured && (
              <p>
                Visitors never sign in: <Link href={`/v/${DEMO_ID}`}>try the demo exhibit</Link>.
              </p>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
