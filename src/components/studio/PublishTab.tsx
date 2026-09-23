'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserDb } from '@/lib/db/client';
import { siteUrl } from '@/lib/db/env';
import styles from '@/app/studio/studio.module.css';
import type { EditorContext } from './Editor';
import { saveToCloud } from './publish';

/** F5: upload + publish, Viewer URL + QR, printing checklist, geometry warnings. */
export function PublishTab({ ctx }: { ctx: EditorContext }) {
  const { project, ready, signedIn, isNew, storageBase } = ctx;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const viewerUrl = `${siteUrl()}/v/${project.id}`;
  const hasGeometry = !!(ready || project.model?.glbPath);
  const qrUrl =
    ready?.urls.qr ??
    (storageBase ? `${storageBase}/mats/${project.id}/qr-v${project.geometryVersion}.png` : null);

  const run = async (status: 'draft' | 'published') => {
    const db = getBrowserDb();
    if (!db) return setError('Supabase is not configured.');
    setError(null);
    try {
      const saved = await saveToCloud(
        db,
        project,
        ready,
        status,
        (m, f) => {
          setBusy(m);
          setProgress(f);
        },
        ctx.media,
      );
      ctx.markSaved(saved);
      if (isNew) router.replace(`/studio/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!signedIn) {
    return (
      <div className={styles.panel} style={{ maxWidth: 560 }}>
        <p className={styles.warning}>
          Publishing needs an account, so visitors can find the exhibit and you can edit it later.
          Your current work lives only in this tab.
        </p>
        <Link className={styles.primary} href="/login?next=/studio/new" target="_blank">
          Sign in (opens a new tab)
        </Link>
        <p className={styles.small}>
          After signing in, come back to this tab and reload it — or start the exhibit again from
          the Studio once you are signed in.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.split}>
      <div className={styles.panel}>
        <h2>{project.status === 'published' ? 'Published' : 'Not published yet'}</h2>
        {project.status === 'published' && (
          <>
            <p>
              Visitors open <a href={viewerUrl}>{viewerUrl}</a> by scanning the QR code on the mat.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrUrl && <img className={styles.qr} src={qrUrl} alt="QR code for the Viewer" />}
          </>
        )}
        {ready && project.status === 'published' && (
          <p className={styles.warning}>
            You changed the model or its orientation. Publishing replaces the mat: print the new mat
            and put the object on its outline, or visitors will see misaligned labels.
          </p>
        )}
        {!hasGeometry && (
          <p className={styles.warning}>Generate the model and mat in Setup first.</p>
        )}
        {!project.title.trim() && (
          <p className={styles.warning}>Give the exhibit a title (Setup).</p>
        )}
        <div className={styles.row}>
          <button
            className={styles.primary}
            disabled={!!busy || !hasGeometry || !project.title.trim()}
            onClick={() => void run('published')}
          >
            {project.status === 'published' ? 'Update published exhibit' : 'Publish'}
          </button>
          <button className={styles.secondary} disabled={!!busy} onClick={() => void run('draft')}>
            {project.status === 'published' ? 'Unpublish (keep as draft)' : 'Save draft'}
          </button>
          {!isNew && project.status === 'published' && (
            <Link className={styles.secondary} href={`/studio/${project.id}/calibrate`}>
              Calibrate on phone
            </Link>
          )}
        </div>
        {busy && (
          <div className={styles.panel}>
            <span className={styles.small}>{busy}</span>
            <div className={styles.progress}>
              <div style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.panel}>
        <strong>Before visitors arrive</strong>
        <ol className={styles.small} style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Print the mat PDF at 100 % (Mat tab) and check the 100 mm ruler.</li>
          <li>Mount it flat; place the printed object on the solid outline, front toward FRONT.</li>
          <li>
            Open <b>Calibrate on phone</b> once and nudge the ghost model onto the real object.
          </li>
          <li>Scan the QR code yourself and walk around the object.</li>
        </ol>
      </aside>
    </div>
  );
}
