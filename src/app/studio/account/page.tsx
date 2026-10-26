import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/studio/PasswordForm';
import { getCurrentUser } from '@/lib/db/server';
import styles from '../studio.module.css';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio/account');
  return (
    <main className={styles.narrow}>
      <header className={styles.header}>
        <h1>Account</h1>
        <Link className={styles.ghost} href="/studio">
          ← Studio
        </Link>
      </header>
      <p className={styles.muted}>
        Signed in {user.google && 'with Google '}as <b>{user.email}</b>
      </p>
      {/* a Google sign-in has no password here: Google handles it */}
      {!user.google && <PasswordForm />}
    </main>
  );
}
