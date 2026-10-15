'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authErrorCode, authErrorMessage } from '@/lib/db/auth-errors';
import { getBrowserDb } from '@/lib/db/client';
import styles from '../studio/studio.module.css';

type Mode = 'signin' | 'signup';

const NOT_CONFIGURED = 'Sign-in is not configured (missing Supabase env vars).';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'passkey' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Passkey autofill: the browser offers saved passkeys in the email field's suggestions.
  useEffect(() => {
    const db = getBrowserDb();
    if (!db || typeof PublicKeyCredential === 'undefined') return;
    let active = true;
    const listen = async () => {
      if (!(await PublicKeyCredential.isConditionalMediationAvailable?.())) return;
      const { error: err } = await db.auth.signInWithPasskey({
        options: { mediation: 'conditional' },
      });
      if (!active) return;
      if (!err) {
        router.replace(next);
        router.refresh();
        return;
      }
      const code = authErrorCode(err);
      if (code === 'passkey_disabled') return;
      if (code === 'webauthn_challenge_expired') {
        void listen();
        return;
      }
      const text = authErrorMessage(err);
      if (text) setMessage(text);
    };
    void listen();
    return () => {
      active = false;
    };
  }, [next, router]);

  const continueTo = (path: string) => {
    router.replace(path);
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = getBrowserDb();
    if (!db) {
      setMessage(NOT_CONFIGURED);
      return;
    }
    setBusy('password');
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error: err } = await db.auth.signInWithPassword({ email, password });
        if (err) setMessage(authErrorMessage(err));
        else continueTo(next);
      } else {
        // no email: "Confirm email" is off in Supabase, so sign-up returns a session
        const { data, error: err } = await db.auth.signUp({ email, password });
        if (err) setMessage(authErrorMessage(err));
        else if (data.session) continueTo('/studio/account?new=1');
        else setMessage('Account created, but Supabase still requires email confirmation.');
      }
    } finally {
      setBusy(null);
    }
  };

  const signInWithPasskey = async () => {
    const db = getBrowserDb();
    if (!db) {
      setMessage(NOT_CONFIGURED);
      return;
    }
    setBusy('passkey');
    setMessage(null);
    // replaces a pending autofill request (auth-js aborts it)
    const { error: err } = await db.auth.signInWithPasskey();
    setBusy(null);
    if (err) setMessage(authErrorMessage(err));
    else continueTo(next);
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setMessage(null);
  };

  const submitLabel = {
    signin: busy === 'password' ? 'Signing in…' : 'Sign in',
    signup: busy === 'password' ? 'Creating account…' : 'Create account',
  }[mode];

  return (
    <div className={styles.form}>
      <form onSubmit={submit} className={styles.form}>
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="username webauthn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@museum.org"
          />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && <small className={styles.small}>At least 8 characters.</small>}
        </label>
        <button className={styles.primary} disabled={busy !== null}>
          {submitLabel}
        </button>
      </form>

      {mode === 'signin' && (
        <>
          <p className={styles.divider}>or</p>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy !== null}
            onClick={signInWithPasskey}
          >
            {busy === 'passkey' ? 'Waiting for passkey…' : 'Sign in with a passkey'}
          </button>
        </>
      )}

      {message && <p className={styles.error}>{message}</p>}

      <p className={styles.small}>
        {mode === 'signin' ? (
          <>
            New here?{' '}
            <button type="button" className={styles.link} onClick={() => switchTo('signup')}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button type="button" className={styles.link} onClick={() => switchTo('signin')}>
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
