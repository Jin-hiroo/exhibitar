'use client';

import { useEffect, useSyncExternalStore } from 'react';
import styles from './landing.module.css';
import { LANG_KEY } from './T';

type Lang = 'en' | 'ja';

function landingRoot(): HTMLElement | null {
  return document.querySelector('[data-landing]');
}

function storedOrBrowserLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'ja') return stored;
  } catch {
    // storage blocked: fall through to the browser language
  }
  const first = navigator.languages?.[0] ?? navigator.language ?? '';
  return first.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function apply(root: HTMLElement, lang: Lang) {
  root.setAttribute('data-lang', lang);
  root.setAttribute('lang', lang);
}

function subscribe(onChange: () => void) {
  const root = landingRoot();
  if (!root) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(root, { attributes: true, attributeFilter: ['data-lang'] });
  return () => observer.disconnect();
}

const currentLang = (): Lang => (landingRoot()?.getAttribute('data-lang') === 'ja' ? 'ja' : 'en');

/** EN / 日本語 switch. Its look comes from CSS on the root, so it is right before hydration. */
export function LangSwitch() {
  const lang = useSyncExternalStore(subscribe, currentLang, () => 'en');

  // After a client-side navigation the inline script in LANG_SCRIPT has not run.
  useEffect(() => {
    const root = landingRoot();
    if (root && !root.hasAttribute('data-lang-set')) {
      apply(root, storedOrBrowserLang());
      root.setAttribute('data-lang-set', '');
    }
  }, []);

  function choose(next: Lang) {
    const root = landingRoot();
    if (root) apply(root, next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // private mode: the choice lasts for this page view only
    }
  }

  return (
    <div className={styles.langSwitch} role="group" aria-label="Language / 言語">
      <button
        type="button"
        lang="en"
        className={styles.langEn}
        aria-pressed={lang === 'en'}
        onClick={() => choose('en')}
      >
        EN
      </button>
      <button
        type="button"
        lang="ja"
        className={styles.langJa}
        aria-pressed={lang === 'ja'}
        onClick={() => choose('ja')}
      >
        日本語
      </button>
    </div>
  );
}
