import Link from 'next/link';
import { SignInSheet } from '@/components/studio/SignInSheet';
import { oauthErrorMessage } from '@/lib/db/auth-errors';
import { supabaseEnv } from '@/lib/db/env';
import { listMyProjects } from '@/lib/db/projects';
import { getCurrentUser, getServerDb, isGoogleSignInEnabled } from '@/lib/db/server';
import { safeNextPath } from '@/lib/safe-redirect';
import styles from './studio.module.css';

export default async function StudioPage(props: PageProps<'/studio'>) {
  const user = await getCurrentUser();
  // Signed out, the Studio is where exhibitors sign in: making an exhibit needs an account.
  if (!user) {
    const [sp, google] = await Promise.all([props.searchParams, isGoogleSignInEnabled()]);
    return (
      <SignInSheet
        next={safeNextPath(sp.next)}
        google={google}
        error={oauthErrorMessage(sp.error)}
        configured={!!supabaseEnv()}
      />
    );
  }
  const db = await getServerDb();
  const projects = db ? await listMyProjects(db).catch(() => []) : [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Studio</h1>
        <span className={styles.small}>{user.email}</span>
        {/* the account page only changes the password, which a Google sign-in doesn't have */}
        {!user.google && (
          <Link className={styles.ghost} href="/studio/account">
            Account
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button className={styles.ghost}>Sign out</button>
        </form>
        <Link className={styles.primary} href="/studio/new">
          + New exhibit
        </Link>
      </header>

      {projects.length === 0 && (
        <p className={styles.muted}>No exhibits yet. Create one from an STL file.</p>
      )}

      {projects.length > 0 && (
        <div className={styles.cards}>
          {projects.map((p) => (
            <Link key={p.id} href={`/studio/${p.id}`} className={styles.card}>
              <strong>{p.title || 'Untitled exhibit'}</strong>
              <span
                className={`${styles.badge} ${p.status === 'published' ? styles.badgePublished : ''}`}
              >
                {p.status === 'published' ? 'Published' : 'Draft'}
              </span>
              <span className={styles.small}>
                Updated {new Date(p.updatedAt).toLocaleString()} · {p.viewCount} views
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
