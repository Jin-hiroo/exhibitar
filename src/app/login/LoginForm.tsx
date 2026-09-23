'use client';

import { useState } from 'react';
import { getBrowserDb } from '@/lib/db/client';
import styles from '../studio/studio.module.css';

export function LoginForm({ next, error }: { next: string; error: string | null }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(error);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = getBrowserDb();
    if (!db) {
      setState('error');
      setMessage('Sign-in is not configured (missing Supabase env vars).');
      return;
    }
    setState('sending');
    setMessage(null);
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect, shouldCreateUser: true },
    });
    if (err) {
      setState('error');
      setMessage(err.message);
    } else {
      setState('sent');
    }
  };

  if (state === 'sent') {
    return (
      <p className={styles.notice}>
        Check <b>{email}</b> for a sign-in link. You can close this tab.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@museum.org"
        />
      </label>
      <button className={styles.primary} disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {message && <p className={styles.error}>{message}</p>}
    </form>
  );
}
