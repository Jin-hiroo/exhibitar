'use client';

import { useState } from 'react';
import { authErrorMessage } from '@/lib/db/auth-errors';
import { getBrowserDb } from '@/lib/db/client';
import styles from '@/app/studio/studio.module.css';

/** Account settings: change the password of an email + password sign-in. */
export function PasswordForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = getBrowserDb();
    if (!db) return;
    setBusy(true);
    setMessage(null);
    setNotice(null);
    const { error } = await db.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(authErrorMessage(error));
      return;
    }
    setPassword('');
    setNotice('Password updated.');
  };

  return (
    <section className={styles.form}>
      <h2>Password</h2>
      <form onSubmit={submit} className={styles.form}>
        <label className={styles.field}>
          <span>New password</span>
          <input
            type="password"
            name="new-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small className={styles.small}>At least 8 characters.</small>
        </label>
        <button className={styles.secondary} disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
      {notice && <p className={styles.notice}>{notice}</p>}
      {message && <p className={styles.error}>{message}</p>}
    </section>
  );
}
