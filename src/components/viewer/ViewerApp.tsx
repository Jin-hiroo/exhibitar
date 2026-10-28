'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeLink } from '@/lib/annotations/list';
import { arAvailable, type ArCapabilities } from '@/lib/ar/capabilities';
import type { ArRuntime, ArStatus, OrbitViewer, PreparedExhibit } from '@/lib/ar/launch';
import type { ViewerProject } from '@/lib/types';
import styles from './viewer.module.css';

type Mode = 'landing' | 'ar' | 'orbit';

// Start fetching the 3D runtime as soon as this module runs (before hydration finishes).
const runtimeImport = typeof window !== 'undefined' ? import('@/lib/ar/launch') : null;

interface Props {
  project: ViewerProject;
  /** base URL for project storage paths */
  assetBase: string;
}

/**
 * Audience Viewer (SPEC §4): landing card → AR (matar: the phone camera in the
 * page, iPhone and Android alike) or the fallback 3D viewer, with labels,
 * tap-for-details and a simple guided tour.
 */
export function ViewerApp({ project, assetBase }: Props) {
  const [caps, setCaps] = useState<ArCapabilities | null>(null);
  const [prepared, setPrepared] = useState<PreparedExhibit | null>(null);
  const [mode, setMode] = useState<Mode>('landing');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ArStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState(true);
  // ?debug shows the tracking HUD and marker outlines (only rendered in AR, so no hydration mismatch)
  const [debug, setDebug] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'),
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const arRef = useRef<ArRuntime | null>(null);
  const orbitViewerRef = useRef<OrbitViewer | null>(null);
  /** mirrors UI selections (tour, close) into whichever 3D scene is active */
  const sceneSelectRef = useRef<(id: string | null) => void>(() => {});
  const runtimeModule = useRef<typeof import('@/lib/ar/launch') | null>(null);

  const tour = useMemo(
    () => [...project.annotations].sort((a, b) => a.order - b.order),
    [project.annotations],
  );
  const selectedAnnotation = tour.find((a) => a.id === selected) ?? null;
  // design ≤ 2 mats carry WebXR image markers, which matar can't track
  const trackable = (project.mat.tags?.length ?? 0) > 0;
  // project data is untrusted here: only http(s) links, whatever was stored
  const safeLink = selectedAnnotation?.link ? sanitizeLink(selectedAnnotation.link) : undefined;

  // E5: count one view per page load for published (database) exhibits
  useEffect(() => {
    if (assetBase === '/') return; // bundled demo fixtures
    const key = `exhibitar.viewed.${project.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // storage unavailable: count anyway
    }
    import('@/lib/db/client')
      .then(({ getBrowserDb }) => getBrowserDb()?.rpc('record_view', { p_id: project.id }))
      .catch(() => {});
  }, [project.id, assetBase]);

  // Capabilities + prefetch the runtime and the GLB (ARCHITECTURE §5).
  useEffect(() => {
    let cancelled = false;
    import('@/lib/ar/capabilities')
      .then((m) => m.detectArCapabilities())
      .then((c) => !cancelled && setCaps(c));
    (runtimeImport ?? import('@/lib/ar/launch'))
      .then(async (m) => {
        runtimeModule.current = m;
        const p = await m.prepareExhibit(project, assetBase);
        if (!cancelled) setPrepared(p);
      })
      .catch((e: unknown) => !cancelled && setError(`Could not load the exhibit: ${message(e)}`));
    return () => {
      cancelled = true;
    };
  }, [project, assetBase]);

  /** Select from UI (tour, close) and mirror it into the 3D scene. */
  const selectFromUi = (id: string | null) => {
    setSelected(id);
    sceneSelectRef.current(id);
  };

  // --- AR ------------------------------------------------------------------

  const startAr = () => {
    const m = runtimeModule.current;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!m || !prepared || !stage || !overlay) return;
    setError(null);
    setStatus(null);
    setSelected(null);
    const exhibit = prepared.createScene();
    sceneSelectRef.current = (id) => exhibit.select(id);
    const leave = () => {
      arRef.current = null;
      exhibit.dispose();
      stage.classList.remove(styles.active!);
      overlay.classList.remove(styles.active!);
      setMode('landing');
    };
    const runtime = new m.ArRuntime({
      project,
      exhibit,
      container: stage,
      onStatus: setStatus,
      onSelect: setSelected,
      onGuide: (g) => {
        const el = guideRef.current;
        if (!el) return;
        el.style.display = g ? 'block' : 'none';
        if (g) {
          el.style.left = `${g.x * 100}%`;
          el.style.top = `${g.y * 100}%`;
          el.style.transform = `translate(-50%, -50%) rotate(${g.angleDeg}deg)`;
        }
      },
      onEnd: (err) => {
        leave();
        if (err) setError(err);
      },
    });
    arRef.current = runtime;
    // the view must have its size when the camera starts, before React re-renders
    stage.classList.add(styles.active!);
    overlay.classList.add(styles.active!);
    setMode('ar');
    runtime.setGhost(ghost);
    runtime.setDebug(debug);
    // the camera prompt needs this tap (transient user activation): start right away
    runtime.start().catch((e: unknown) => {
      leave();
      setError(m.cameraErrorText(e));
    });
  };

  // leaving the page while AR runs: release the camera
  useEffect(() => () => arRef.current?.stop(), []);

  useEffect(() => {
    arRef.current?.setGhost(ghost);
  }, [ghost]);
  useEffect(() => {
    arRef.current?.setDebug(debug);
  }, [debug]);

  // --- fallback 3D -----------------------------------------------------------

  useEffect(() => {
    if (mode !== 'orbit' || !prepared || !orbitRef.current) return;
    const m = runtimeModule.current!;
    const exhibit = prepared.createScene();
    sceneSelectRef.current = (id) => exhibit.select(id);
    const viewer = new m.OrbitViewer({
      container: orbitRef.current,
      project,
      exhibit,
      markerUrls: prepared.assets.markerUrls,
      onSelect: setSelected,
    });
    orbitViewerRef.current = viewer;
    return () => {
      viewer.dispose();
      exhibit.dispose();
      orbitViewerRef.current = null;
    };
  }, [mode, prepared, project]);

  const tourIndex = selected ? tour.findIndex((a) => a.id === selected) : -1;
  const step = (d: number) => {
    if (!tour.length) return;
    const next =
      tourIndex < 0 ? (d > 0 ? 0 : tour.length - 1) : (tourIndex + d + tour.length) % tour.length;
    selectFromUi(tour[next]!.id);
  };

  const sheet = selectedAnnotation && (
    <div className={styles.sheet} data-ui>
      <div className={styles.sheetHeader}>
        <span className={styles.badge}>{tour.indexOf(selectedAnnotation) + 1}</span>
        <h2 className={styles.sheetTitle}>{selectedAnnotation.title}</h2>
        <button className={styles.close} onClick={() => selectFromUi(null)} aria-label="Close">
          ✕
        </button>
      </div>
      {selectedAnnotation.body && <p className={styles.sheetBody}>{selectedAnnotation.body}</p>}
      {selectedAnnotation.imagePath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${assetBase.replace(/\/+$/, '')}/${selectedAnnotation.imagePath}`} alt="" />
      )}
      {safeLink && (
        <a href={safeLink} target="_blank" rel="noopener noreferrer">
          Learn more ↗
        </a>
      )}
    </div>
  );

  const tourBar = tour.length > 0 && !selectedAnnotation && (
    <div className={styles.tour} data-ui>
      <button className={styles.chipButton} onClick={() => step(-1)} aria-label="Previous">
        ‹
      </button>
      <span className={styles.chip}>Tour · {tour.length} points</span>
      <button className={styles.chipButton} onClick={() => step(1)} aria-label="Next">
        ›
      </button>
    </div>
  );

  return (
    <>
      {mode === 'landing' && (
        <main className={styles.page}>
          <section className={styles.card}>
            <span className={styles.eyebrow}>AR exhibit</span>
            <h1 className={styles.title}>{project.title}</h1>
            {project.description && <p className={styles.description}>{project.description}</p>}
            <button
              className={styles.primary}
              onClick={startAr}
              disabled={!prepared || !caps || !arAvailable(caps) || !trackable}
            >
              {!prepared ? 'Loading…' : 'Start AR'}
            </button>
            <button
              className={styles.secondary}
              onClick={() => setMode('orbit')}
              disabled={!prepared}
            >
              View in 3D
            </button>
            {caps && <CapabilityNote caps={caps} trackable={trackable} />}
            {error && <p className={styles.error}>{error}</p>}
            <p className={styles.fine}>
              Point your phone at the printed mat. Tracking uses only the mat, not the object.
            </p>
          </section>
        </main>
      )}

      {/* AR: the camera view, and the UI on top of it */}
      <div ref={stageRef} className={`${styles.stage} ${mode === 'ar' ? styles.active : ''}`} />
      <div ref={overlayRef} className={`${styles.overlay} ${mode === 'ar' ? styles.active : ''}`}>
        {mode === 'ar' && (
          <>
            <div className={styles.topBar}>
              <button className={styles.chipButton} data-ui onClick={() => arRef.current?.stop()}>
                ✕ Exit
              </button>
              <span className={styles.chip}>{statusText(status)}</span>
              <span className={styles.spacer} />
              <button
                className={styles.chipButton}
                data-ui
                aria-pressed={ghost}
                onClick={() => setGhost((g) => !g)}
              >
                Model
              </button>
              <button
                className={styles.chipButton}
                data-ui
                aria-pressed={debug}
                onClick={() => setDebug((d) => !d)}
              >
                Debug
              </button>
            </div>
            {(!status || status.phase === 'searching' || status.phase === 'starting') && (
              <div className={styles.hint}>
                <strong>Point your camera at the mat</strong>
                {searchHint()}
              </div>
            )}
            {debug && status && <pre className={styles.debug}>{debugText(status)}</pre>}
            <div ref={guideRef} className={styles.guide} aria-hidden>
              ➜
            </div>
            {tourBar}
            {sheet}
          </>
        )}
      </div>

      {mode === 'orbit' && (
        <div className={styles.orbit}>
          <div ref={orbitRef} className={styles.orbitCanvas} />
          <div className={styles.topBar}>
            <button className={styles.chipButton} onClick={() => setMode('landing')}>
              ‹ Back
            </button>
            <span className={styles.chip}>{project.title} · 3D view</span>
          </div>
          {!prepared && <div className={styles.loading}>Loading…</div>}
          {tourBar}
          {sheet}
        </div>
      )}
    </>
  );
}

function CapabilityNote({ caps, trackable }: { caps: ArCapabilities; trackable: boolean }) {
  const cls = styles.note;
  if (!trackable) {
    return (
      <p className={cls}>
        This exhibit&apos;s mat was made for an older version of the app, so AR can&apos;t track it.
        The exhibitor needs to rebuild and reprint the mat. You can still explore the exhibit in 3D.
      </p>
    );
  }
  if (!caps.secureContext) {
    return <p className={cls}>AR needs a secure connection (https:// or localhost).</p>;
  }
  if (!caps.camera || !caps.webgl) {
    return (
      <p className={cls}>
        AR isn&apos;t available in this browser. Open this page in Safari on iPhone or Chrome on
        Android. You can still explore the exhibit in 3D.
      </p>
    );
  }
  if (caps.inAppBrowser) {
    return (
      <p className={cls}>
        You&apos;re in {caps.inAppBrowser}&apos;s built-in browser, which may block the camera. If
        AR doesn&apos;t start, open this page in {caps.ios ? 'Safari' : 'Chrome'} (menu → Open in
        browser).
      </p>
    );
  }
  return null;
}

function statusText(s: ArStatus | null): string {
  if (!s || s.phase === 'starting') return 'Starting camera…';
  if (s.phase === 'searching') return 'Looking for the mat…';
  if (s.phase === 'holding') return 'Mat out of view';
  return `Tracking · ${s.tagsUsed} tag${s.tagsUsed === 1 ? '' : 's'}`;
}

/**
 * Where to hold the phone while searching: the mat's tags are found from
 * anywhere they fill a few pixels per cell, so the advice is about seeing
 * enough of the mat, not about distance.
 */
function searchHint(): string {
  return 'Hold the phone above the mat so most of it is on the screen.';
}

function debugText(s: ArStatus): string {
  return [
    `phase   ${s.phase}   fps ${s.fps.toFixed(0)}   worker ${s.worker ?? '-'}`,
    `tags    ${s.tagsFound} found, ${s.tagsUsed} used of ${s.tagsTotal}`,
    `err     ${s.errPx != null ? `${s.errPx.toFixed(2)} px` : '-'}`,
    `focal   ${s.focalPx != null ? `${s.focalPx.toFixed(0)} px (${s.focalSource})` : '-'}`,
    `camera  ${s.camera || '-'}`,
  ].join('\n');
}

function message(e: unknown): string {
  return e instanceof Error ? `${e.name === 'Error' ? '' : `${e.name}: `}${e.message}` : String(e);
}
