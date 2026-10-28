'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BufferGeometry } from 'three';
import type { StudioProject } from '@/lib/db/mapping';
import { storagePublicBase } from '@/lib/db/env';
import type { GeneratedMat } from '@/lib/mat/generate';
import type { LoadedModel, PreparedModel } from '@/lib/geometry/pipeline';
import type { LengthUnit } from '@/lib/units';
import { createGeometryClient } from '@/workers/geometry.client';
import { createMatClient } from '@/workers/mat.client';
import styles from '@/app/studio/studio.module.css';
import { SetupTab } from './SetupTab';

// The other tabs (three.js, the AR scene, Supabase, PDF) load when first opened.
const loadingTab = () => <p className={styles.muted}>Loading…</p>;
const MatTab = dynamic(() => import('./MatTab').then((m) => m.MatTab), { loading: loadingTab });
const AnnotateTab = dynamic(() => import('./annotate/AnnotateTab').then((m) => m.AnnotateTab), {
  ssr: false,
  loading: loadingTab,
});
const PreviewTab = dynamic(() => import('./PreviewTab').then((m) => m.PreviewTab), {
  ssr: false,
  loading: loadingTab,
});
const PublishTab = dynamic(() => import('./PublishTab').then((m) => m.PublishTab), {
  loading: loadingTab,
});

export type Tab = 'setup' | 'mat' | 'annotate' | 'preview' | 'publish';

/** STL in memory (never uploaded) and what the exhibitor chose for it. */
export interface GeometrySession {
  stl: ArrayBuffer;
  fileName: string;
  unit: LengthUnit;
  uniformScale: number;
  loaded: LoadedModel;
  candidate: number;
  frontYawDeg: number;
}

/** A freshly prepared model + mat, not uploaded yet. */
export interface PreparedSession {
  prepared: PreparedModel;
  mat: GeneratedMat;
  geometryVersion: number;
  /** object URLs for previews: 'svg' / 'qr' / 'pdf' */
  urls: Record<string, string>;
}

export interface EditorContext {
  project: StudioProject;
  setProject: (update: (p: StudioProject) => StudioProject) => void;
  geo: GeometrySession | null;
  setGeo: (g: GeometrySession | null) => void;
  ready: PreparedSession | null;
  setReady: (r: PreparedSession | null) => void;
  /** the stored/frozen model mesh (metres, model coords), when available */
  geometry: BufferGeometry | null;
  geometryClient: ReturnType<typeof createGeometryClient>;
  matClient: ReturnType<typeof createMatClient>;
  /** base URL for storage paths of the saved project */
  storageBase: string | null;
  isNew: boolean;
  signedIn: boolean;
  setTab: (t: Tab) => void;
  /** unsaved changes (text, annotations, geometry) */
  dirty: boolean;
  markSaved: (p: StudioProject) => void;
  /** annotation images chosen but not uploaded yet, by annotation id */
  media: Record<string, File>;
  setMedia: (update: (m: Record<string, File>) => Record<string, File>) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: '1 · Setup' },
  { id: 'mat', label: '2 · Mat' },
  { id: 'annotate', label: '3 · Annotate' },
  { id: 'preview', label: '4 · Preview' },
  { id: 'publish', label: '5 · Publish' },
];

export function Editor({
  initial,
  isNew,
  signedIn,
}: {
  initial: StudioProject;
  isNew: boolean;
  signedIn: boolean;
}) {
  const [project, setProjectState] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [geo, setGeo] = useState<GeometrySession | null>(null);
  const [ready, setReadyState] = useState<PreparedSession | null>(null);
  const [storedGeometry, setStoredGeometry] = useState<BufferGeometry | null>(null);
  const [tab, setTab] = useState<Tab>(initial.model ? 'annotate' : 'setup');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [media, setMedia] = useState<Record<string, File>>({});
  // workers spawn lazily on first call, so creating the clients during SSR is harmless
  const [clients] = useState(() => ({ geometry: createGeometryClient(), mat: createMatClient() }));
  useEffect(
    () => () => {
      clients.geometry.dispose();
      clients.mat.dispose();
    },
    [clients],
  );

  const storageBase = storagePublicBase();

  // A saved project's stored GLB is the source of truth for annotating (core idea #3).
  useEffect(() => {
    if (!saved.model?.glbPath || !storageBase) return;
    let cancelled = false;
    const url = `${storageBase}/${saved.model.glbPath}`;
    import('./model-geometry')
      .then((m) => m.loadStoredGeometry(url))
      .then((g) => !cancelled && setStoredGeometry(g))
      .catch(
        (e: unknown) => !cancelled && setLoadError(`Could not load the stored model: ${String(e)}`),
      );
    return () => {
      cancelled = true;
    };
  }, [saved.model?.glbPath, storageBase]);

  // three.js is imported lazily, so the prepared mesh becomes a BufferGeometry a tick later
  const [readyGeometry, setReadyGeometry] = useState<{
    from: PreparedSession;
    geometry: BufferGeometry;
  } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import('./model-geometry').then((m) => {
      if (!cancelled) {
        setReadyGeometry({ from: ready, geometry: m.meshToGeometry(ready.prepared.frozenMesh) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
  const geometry =
    (readyGeometry?.from === ready ? readyGeometry.geometry : null) ?? storedGeometry;

  const setReady = (r: PreparedSession | null) => {
    setReadyState((old) => {
      if (old) for (const u of Object.values(old.urls)) URL.revokeObjectURL(u);
      return r;
    });
  };

  const dirty =
    !!ready ||
    Object.keys(media).length > 0 ||
    project.title !== saved.title ||
    project.description !== saved.description ||
    JSON.stringify(project.annotations) !== JSON.stringify(saved.annotations);

  const ctx: EditorContext = {
    project,
    setProject: (u) => setProjectState(u),
    geo,
    setGeo,
    ready,
    setReady,
    geometry,
    geometryClient: clients.geometry,
    matClient: clients.mat,
    storageBase,
    isNew,
    signedIn,
    setTab,
    dirty,
    markSaved: (p) => {
      setSaved(p);
      setProjectState(p);
      setReady(null);
      setMedia({});
    },
    media,
    setMedia: (u) => setMedia(u),
  };

  const hasMat = !!project.mat;
  const hasModel = !!geometry;
  const enabled: Record<Tab, boolean> = {
    setup: true,
    mat: hasMat,
    annotate: hasModel,
    preview: hasModel && hasMat,
    publish: true,
  };

  // fetch the 3D tabs in the background once they have something to show
  useEffect(() => {
    if (!hasModel) return;
    void import('./annotate/AnnotateTab');
    void import('./PreviewTab');
  }, [hasModel]);

  // warn before losing unsaved work (the STL is never stored anywhere)
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/studio" className={styles.ghost}>
          ‹ Studio
        </Link>
        <h1>{project.title || 'Untitled exhibit'}</h1>
        <span
          className={`${styles.badge} ${project.status === 'published' ? styles.badgePublished : ''}`}
        >
          {project.status === 'published' ? 'Published' : isNew ? 'New draft' : 'Draft'}
          {dirty ? ' · unsaved' : ''}
        </span>
      </header>
      {!signedIn && (
        <p className={styles.warning}>
          You are not signed in: everything stays in this tab. Sign in before publishing to keep
          your exhibit.
        </p>
      )}
      {loadError && <p className={styles.error}>{loadError}</p>}
      <nav className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={styles.tab}
            aria-selected={tab === t.id}
            disabled={!enabled[t.id]}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'setup' && <SetupTab ctx={ctx} />}
      {tab === 'mat' && enabled.mat && <MatTab ctx={ctx} />}
      {tab === 'annotate' && enabled.annotate && <AnnotateTab ctx={ctx} />}
      {tab === 'preview' && enabled.preview && <PreviewTab ctx={ctx} />}
      {tab === 'publish' && <PublishTab ctx={ctx} />}
    </main>
  );
}
