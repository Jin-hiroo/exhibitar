import Link from 'next/link';
import { oauthErrorMessage } from '@/lib/db/auth-errors';
import { isGoogleSignInEnabled } from '@/lib/db/server';
import { safeNextPath } from '@/lib/safe-redirect';
import { LoginForm } from './LoginForm';
import styles from '../studio/studio.module.css';

export default async function LoginPage(props: PageProps<'/login'>) {
  const [sp, google] = await Promise.all([props.searchParams, isGoogleSignInEnabled()]);
  const next = safeNextPath(sp.next);
  return (
    <main className={styles.narrow}>
      <h1>Sign in</h1>
      <p className={styles.muted}>
        Exhibitors sign in to publish exhibits, with{' '}
        {google ? 'Google, email and password, or a passkey' : 'email and password or a passkey'}.
      </p>
      <LoginForm next={next} google={google} error={oauthErrorMessage(sp.error)} />
      <p className={styles.muted}>
        Just trying things out? <Link href="/studio/new">Open the Studio</Link> without an account.
      </p>
      <p className={styles.muted}>
        By signing in or creating an account, you agree to the{' '}
        <Link href="/terms">Terms of service</Link> and the{' '}
        <Link href="/privacy">Privacy policy</Link>.
      </p>
    </main>
  );
}
