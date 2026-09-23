'use client';

import { printInstructions } from '@/lib/mat/instructions';
import styles from '@/app/studio/studio.module.css';
import type { EditorContext } from './Editor';

export function MatTab({ ctx }: { ctx: EditorContext }) {
  const { project, ready, storageBase } = ctx;
  const mat = project.mat!;
  const stored = (path: string) => (storageBase && path ? `${storageBase}/${path}` : null);
  const svgUrl = ready?.urls.svg ?? stored(mat.svgPath);
  const pdfUrl = ready?.urls.pdf ?? stored(mat.svgPath.replace(/\.svg$/, '.pdf'));
  const qrUrl = ready?.urls.qr ?? stored(`mats/${project.id}/qr-v${project.geometryVersion}.png`);
  const sheets = mat.tiles.cols * mat.tiles.rows;
  const base = `${(project.title || 'exhibit').replace(/[^\w-]+/g, '-')}-mat`;

  return (
    <div className={styles.split}>
      <div className={styles.panel}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {svgUrl && <img className={styles.matPreview} src={svgUrl} alt="Placement mat" />}
      </div>
      <aside className={styles.panel}>
        <strong>
          {mat.paper} {mat.orientation}
          {sheets > 1 ? ` · ${sheets} sheets (${mat.tiles.cols} × ${mat.tiles.rows})` : ''}
        </strong>
        <span className={styles.small}>
          {Math.round(mat.sizeMm[0])} × {Math.round(mat.sizeMm[1])} mm · {mat.markers.length}{' '}
          markers + whole-page tracking
        </span>
        <div className={styles.row}>
          {pdfUrl && (
            <a className={styles.primary} href={pdfUrl} download={`${base}.pdf`}>
              Download PDF
            </a>
          )}
          {svgUrl && (
            <a className={styles.secondary} href={svgUrl} download={`${base}.svg`}>
              SVG
            </a>
          )}
          {qrUrl && (
            <a className={styles.secondary} href={qrUrl} download={`${base}-qr.png`}>
              QR code
            </a>
          )}
        </div>
        {!ready && !storageBase && <p className={styles.small}>Files appear after publishing.</p>}
        <pre className={styles.small} style={{ whiteSpace: 'pre-wrap' }}>
          {printInstructions(mat, project.title || 'this exhibit')}
        </pre>
        {ready && project.status === 'published' && (
          <p className={styles.warning}>
            This is a new mat. After you publish, the old printed mat no longer matches: print this
            one.
          </p>
        )}
      </aside>
    </div>
  );
}
