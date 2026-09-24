import Link from 'next/link';
import { listMyProjects } from '@/lib/db/projects';
import { getCurrentUser, getServerDb } from '@/lib/db/server';
import styles from './studio.module.css';

export default async function StudioPage() {
  const user = await getCurrentUser();
  const db = user ? await getServerDb() : null;
  const projects = db ? await listMyProjects(db).catch(() => []) : [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Studio</h1>
        {user ? (
          <>
            <span className={styles.small}>{user.email}</span>
            <Link className={styles.ghost} href="/studio/account">
              Account
            </Link>
            <form action="/auth/signout" method="post">
              <button className={styles.ghost}>Sign out</button>
            </form>
          </>
        ) : (
          <Link className={styles.secondary} href="/login?next=/studio">
            Sign in
          </Link>
        )}
        <Link className={styles.primary} href="/studio/new">
          + New exhibit
        </Link>
      </header>

      {!user && (
        <p className={styles.muted}>
          You can prepare a model, generate its placement mat and add annotations without an
          account. Sign in to publish exhibits and come back to edit them.
        </p>
      )}

      {user && projects.length === 0 && (
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
