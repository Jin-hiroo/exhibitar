import type { ReactNode } from 'react';
import styles from './landing.module.css';

/**
 * One piece of copy in both languages. Both are in the HTML; the landing root's
 * `data-lang` shows one (see LANG_SCRIPT), so switching needs no reload.
 */
export function T({ en, ja }: { en: ReactNode; ja: ReactNode }) {
  return (
    <>
      <span lang="en" className={styles.en}>
        {en}
      </span>
      <span lang="ja" className={styles.ja}>
        {ja}
      </span>
    </>
  );
}

export const LANG_KEY = 'exhibitar.lang';

/**
 * Runs before the landing content paints: a stored choice wins, otherwise the
 * browser's first language. Without JS the page stays in English.
 */
export const LANG_SCRIPT = `(function(r){try{var l=localStorage.getItem('${LANG_KEY}');if(l!=='en'&&l!=='ja'){var n=(navigator.languages&&navigator.languages[0])||navigator.language||'';l=n.toLowerCase().indexOf('ja')===0?'ja':'en'}r.setAttribute('data-lang',l);r.setAttribute('lang',l);r.setAttribute('data-lang-set','')}catch(e){}})(document.currentScript.parentNode)`;
