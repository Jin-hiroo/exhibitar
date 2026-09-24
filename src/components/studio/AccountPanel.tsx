'use client';

import type { PasskeyListItem } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { authErrorCode, authErrorMessage } from '@/lib/db/auth-errors';
import { getBrowserDb } from '@/lib/db/client';
import styles from '@/app/studio/studio.module.css';

/** Account settings: passkeys (add / remove) and password (change). */
export function AccountPanel({ welcome }: { welcome: boolean }) {
  return (
    <>
      <Passkeys welcome={welcome} />
      <Password />
    </>
  );
}

type PasskeyState = {
  passkeys: PasskeyListItem[];
  status: 'ok' | 'disabled' | 'unsupported';
  error: string | null;
};

async function fetchPasskeys(): Promise<PasskeyState> {
  const db = getBrowserDb();
  if (!db) return { passkeys: [], status: 'ok', error: null };
  const { data, error } = await db.auth.passkey.list();
  const status =
    typeof PublicKeyCredential === 'undefined'
      ? 'unsupported'
      : authErrorCode(error) === 'passkey_disabled'
        ? 'disabled'
        : 'ok';
  return {
    passkeys: data ?? [],
    status,
    error: status === 'ok' && error ? authErrorMessage(error) : null,
  };
}

function Passkeys({ welcome }: { welcome: boolean }) {
  const [state, setState] = useState<PasskeyState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    welcome
      ? 'Account created. Add a passkey to sign in next time with your fingerprint, face or device PIN.'
      : null,
  );

  useEffect(() => {
    let active = true;
    void fetchPasskeys().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const reload = async () => setState(await fetchPasskeys());

  const add = async () => {
    const db = getBrowserDb();
    if (!db) return;
    setBusy(true);
    setMessage(null);
    setNotice(null);
    const { data, error } = await db.auth.registerPasskey();
    setBusy(false);
    if (error) {
      setMessage(authErrorMessage(error));
      return;
    }
    setNotice(`Added ${data.friendly_name ?? 'a passkey'}. You can now sign in with it.`);
    await reload();
  };

  const remove = async (p: PasskeyListItem) => {
    const db = getBrowserDb();
    if (!db) return;
    const name = p.friendly_name ?? 'this passkey';
    if (!window.confirm(`Remove ${name}? You will no longer be able to sign in with it.`)) return;
    setBusy(true);
    setMessage(null);
    setNotice(null);
    const { error } = await db.auth.passkey.delete({ passkeyId: p.id });
    setBusy(false);
    if (error) setMessage(authErrorMessage(error));
    await reload();
  };

  return (
    <section className={styles.form}>
      <h2>Passkeys</h2>
      <p className={styles.small}>
        Sign in with your fingerprint, face or device PIN instead of typing your password.
      </p>
      {notice && <p className={styles.notice}>{notice}</p>}
      {state?.status === 'disabled' && (
        <p className={styles.warning}>Passkeys are not enabled for this site yet.</p>
      )}
      {state?.status === 'unsupported' && (
        <p className={styles.warning}>This browser does not support passkeys.</p>
      )}
      {state === null ? (
        <p className={styles.small}>Loading…</p>
      ) : (
        state.passkeys.length > 0 && (
          <ul className={styles.list}>
            {state.passkeys.map((p) => (
              <li key={p.id} className={styles.card}>
                <div className={styles.row}>
                  <strong style={{ flex: 1 }}>{p.friendly_name ?? 'Passkey'}</strong>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busy}
                    onClick={() => remove(p)}
                  >
                    Remove
                  </button>
                </div>
                <span className={styles.small}>
                  Added {new Date(p.created_at).toLocaleDateString()}
                  {p.last_used_at &&
                    ` · last used ${new Date(p.last_used_at).toLocaleDateString()}`}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
      {state?.status === 'ok' && (
        <button
          type="button"
          className={state.passkeys.length ? styles.secondary : styles.primary}
          disabled={busy}
          onClick={add}
        >
          {busy ? 'Waiting for passkey…' : 'Add a passkey'}
        </button>
      )}
      {(message ?? state?.error) && <p className={styles.error}>{message ?? state?.error}</p>}
    </section>
  );
}

function Password() {
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
