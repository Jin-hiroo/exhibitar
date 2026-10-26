'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authErrorMessage, NOT_CONFIGURED } from '@/lib/db/auth-errors';
import { getBrowserDb } from '@/lib/db/client';
import styles from '../studio/studio.module.css';

type Mode = 'signin' | 'signup';

export function LoginForm({
  next,
  google,
  error,
}: {
  next: string;
  /** the Google provider is enabled in Supabase */
  google: boolean;
  /** why the last Google sign-in failed (from `/auth/callback`) */
  error: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);
  const [message, setMessage] = useState<string | null>(error);

  // Back from Google's page (restored from the back-forward cache): no redirect is pending.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(null);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

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
        else if (data.session) continueTo(next);
        else setMessage('Account created, but Supabase still requires email confirmation.');
      }
    } finally {
      setBusy(null);
    }
  };

  /** Leaves for Google; `/auth/callback` sets the session and continues to `next`. */
  const signInWithGoogle = async () => {
    const db = getBrowserDb();
    if (!db) {
      setMessage(NOT_CONFIGURED);
      return;
    }
    setBusy('google');
    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (err) {
      setBusy(null);
      setMessage(authErrorMessage(err));
    }
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
            autoComplete="username"
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

      {google && (
        <>
          <p className={styles.divider}>or</p>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy !== null}
            onClick={signInWithGoogle}
          >
            <GoogleLogo />
            {busy === 'google' ? 'Redirecting to Google…' : 'Continue with Google'}
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

/** Google's "G" mark, as its sign-in branding guidelines require on the button. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
