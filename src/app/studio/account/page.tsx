import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountPanel } from '@/components/studio/AccountPanel';
import { getCurrentUser } from '@/lib/db/server';
import styles from '../studio.module.css';

export default async function AccountPage(props: PageProps<'/studio/account'>) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/studio/account');
  const sp = await props.searchParams;
  return (
    <main className={styles.narrow}>
      <header className={styles.header}>
        <h1>Account</h1>
        <Link className={styles.ghost} href="/studio">
          ← Studio
        </Link>
      </header>
      <p className={styles.muted}>
        Signed in as <b>{user.email}</b>
      </p>
      <AccountPanel welcome={sp.new === '1'} />
    </main>
  );
}
