'use client';

import { useEffect, useRef } from 'react';
import { ExhibitScene } from '@/lib/ar/exhibit-scene';
import { OrbitViewer } from '@/lib/ar/orbit-viewer';
import { toProject } from '@/lib/db/mapping';
import styles from '@/app/studio/studio.module.css';
import type { EditorContext } from './Editor';

/** F4: the exhibit on its virtual mat, exactly as the fallback Viewer renders it. */
export function PreviewTab({ ctx }: { ctx: EditorContext }) {
  const host = useRef<HTMLDivElement>(null);
  const { project, geometry, ready, storageBase } = ctx;

  useEffect(() => {
    const full = project.mat && geometry ? toProject({ ...project, calibration: zero }) : null;
    if (!full || !host.current || !geometry) return;
    // legacy image markers (design ≤ 2); tags are drawn from their bits
    const markerUrls = (full.mat.markers ?? []).map(
      (m) => ready?.urls[m.id] ?? (storageBase ? `${storageBase}/${m.imagePath}` : ''),
    );
    const exhibit = new ExhibitScene(full, geometry.clone());
    const viewer = new OrbitViewer({
      container: host.current,
      project: full,
      exhibit,
      markerUrls,
      onSelect: () => {},
    });
    return () => {
      viewer.dispose();
      exhibit.dispose();
    };
  }, [project, geometry, ready, storageBase]);

  return (
    <div className={styles.panel}>
      <div ref={host} className={styles.viewport} />
      <p className={styles.small}>
        This is the visitor&apos;s 3D fallback view. In AR the model itself is invisible: the
        printed object hides labels behind it, and labels fade when seen from behind.
      </p>
    </div>
  );
}

const zero = { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 };
