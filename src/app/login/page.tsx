import Link from 'next/link';
import { safeNextPath } from '@/lib/safe-redirect';
import { LoginForm } from './LoginForm';
import styles from '../studio/studio.module.css';

export default async function LoginPage(props: PageProps<'/login'>) {
  const sp = await props.searchParams;
  const next = safeNextPath(sp.next);
  return (
    <main className={styles.narrow}>
      <h1>Sign in</h1>
      <p className={styles.muted}>
        Exhibitors sign in to publish exhibits, with email and password or a passkey.
      </p>
      <LoginForm next={next} />
      <p className={styles.muted}>
        Just trying things out? <Link href="/studio/new">Open the Studio</Link> without an account.
      </p>
    </main>
  );
}
