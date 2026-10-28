'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserDb } from '@/lib/db/client';
import { siteUrl } from '@/lib/db/env';
import { matDesignOutdated, rebuildMatInput } from '@/lib/mat/rebuild';
import styles from '@/app/studio/studio.module.css';
import type { EditorContext } from './Editor';
import { saveToCloud, type NewGeometry } from './publish';

/** F5: upload + publish, Viewer URL + QR, printing checklist, geometry warnings. */
export function PublishTab({ ctx }: { ctx: EditorContext }) {
  const { project, ready, signedIn, isNew, storageBase } = ctx;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const viewerUrl = `${siteUrl()}/v/${project.id}`;
  // the QR was baked into the mat when it was generated; the site URL may have changed since
  const printedUrl = project.mat?.qrUrl;
  const linkDrifted = !!project.mat && project.status === 'published' && printedUrl !== viewerUrl;
  // made before the square tracking tags: the viewer can't track it
  const outdated = !!project.mat && matDesignOutdated(project.mat);
  const hasGeometry = !!(ready || project.model?.glbPath);
  const qrUrl =
    ready?.urls.qr ??
    (storageBase ? `${storageBase}/mats/${project.id}/qr-v${project.geometryVersion}.png` : null);

  const run = async (
    status: 'draft' | 'published',
    newGeometry: NewGeometry | null = ready,
  ): Promise<boolean> => {
    const db = getBrowserDb();
    if (!db) {
      setError('Supabase is not configured.');
      return false;
    }
    setError(null);
    try {
      const saved = await saveToCloud(
        db,
        project,
        newGeometry,
        status,
        (m, f) => {
          setBusy(m);
          setProgress(f);
        },
        ctx.media,
      );
      ctx.markSaved(saved);
      if (isNew) router.replace(`/studio/${saved.id}`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  // a new mat for the current link from the stored outlines: no STL needed, same GLB
  const remakeMat = async () => {
    const mat = project.mat;
    if (!mat) return;
    setError(null);
    setBusy('Generating the new mat…');
    setProgress(0.02);
    try {
      const input = rebuildMatInput({ ...project, mat }, siteUrl());
      const generated = await ctx.matClient.call('generate', input);
      const saved = await run(project.status, {
        geometryVersion: input.geometryVersion,
        mat: generated,
      });
      if (saved) ctx.setTab('mat');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        {(linkDrifted || outdated) && !ready && (
          <div className={styles.warning}>
            <p>
              {outdated &&
                "This mat was made before the current mat design (square tracking tags), and the viewer can't track it. "}
              {linkDrifted &&
                (printedUrl
                  ? `The QR code on this mat opens ${printedUrl}, not the link above. `
                  : 'This mat was made before the Studio recorded its QR link. If scanning it does not open the link above, replace it. ')}
              Make a new mat, then print it and throw the old one away: it also gets new tags. Your
              annotations stay as they are.
            </p>
            <button className={styles.primary} disabled={!!busy} onClick={() => void remakeMat()}>
              {linkDrifted && !outdated ? 'Make a new mat with this link' : 'Make a new mat'}
            </button>
          </div>
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
