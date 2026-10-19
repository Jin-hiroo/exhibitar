'use client';

import { useSyncExternalStore } from 'react';
import { LANG_SCRIPT } from './T';

const subscribeNever = () => () => {};

/**
 * LANG_SCRIPT, in the server HTML only. React never runs a script it creates in
 * the browser (and warns if asked to), so once hydrated, and on a client-side
 * navigation back to the page, this renders nothing; LangSwitch sets the
 * language then.
 */
export function LangScript() {
  const fromServer = useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true,
  );
  return fromServer ? <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} /> : null;
}
