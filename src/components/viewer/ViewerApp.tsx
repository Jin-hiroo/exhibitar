'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArCapabilities } from '@/lib/ar/capabilities';
import type { ArRuntime, ArStatus, OrbitViewer, PreparedExhibit } from '@/lib/ar/launch';
import type { ViewerProject } from '@/lib/types';
import styles from './viewer.module.css';

type Mode = 'landing' | 'ar' | 'orbit';

interface Props {
  project: ViewerProject;
  /** base URL for project storage paths */
  assetBase: string;
}

/**
 * Audience Viewer (SPEC §4): landing card → AR (Android WebXR) or the
 * fallback 3D viewer, with labels, tap-for-details and a simple guided tour.
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
  const overlayRef = useRef<HTMLDivElement>(null);
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

  // Capabilities + prefetch the runtime, GLB and marker images (ARCHITECTURE §5).
  useEffect(() => {
    let cancelled = false;
    import('@/lib/ar/capabilities')
      .then((m) => m.detectArCapabilities())
      .then((c) => !cancelled && setCaps(c));
    import('@/lib/ar/launch')
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
    const overlay = overlayRef.current;
    if (!m || !prepared || !overlay) return;
    setError(null);
    setStatus(null);
    setSelected(null);
    const exhibit = prepared.createScene();
    sceneSelectRef.current = (id) => exhibit.select(id);
    const params = new URLSearchParams(window.location.search);
    const override = params.get('convention');
    const runtime = new m.ArRuntime({
      project,
      exhibit,
      markerBitmaps: prepared.assets.markerBitmaps,
      // ?mattrack=0 tracks the corner markers only (to compare on a device)
      matBitmap: params.get('mattrack') === '0' ? null : prepared.assets.matBitmap,
      overlayRoot: overlay,
      onStatus: setStatus,
      onSelect: setSelected,
      onEnd: () => {
        arRef.current = null;
        exhibit.dispose();
        overlay.classList.remove(styles.active!);
        setMode('landing');
      },
      conventionOverride: override === 'spec' || override === 'arcore' ? override : undefined,
    });
    arRef.current = runtime;
    // the overlay must be displayable when the session starts, before React re-renders
    overlay.classList.add(styles.active!);
    setMode('ar');
    // requestSession must run inside this tap (transient user activation)
    runtime
      .start()
      .then(() => {
        runtime.setGhost(ghost);
        runtime.setDebug(debug);
      })
      .catch((e: unknown) => {
        arRef.current = null;
        exhibit.dispose();
        overlay.classList.remove(styles.active!);
        setMode('landing');
        setError(arErrorText(e));
      });
  };

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
      {selectedAnnotation.link && (
        <a href={selectedAnnotation.link} target="_blank" rel="noopener noreferrer">
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
              disabled={!prepared || !caps?.immersiveAr}
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
            {caps && <CapabilityNote caps={caps} />}
            {error && <p className={styles.error}>{error}</p>}
            <p className={styles.fine}>
              Point your phone at the printed mat. Tracking uses only the square markers.
            </p>
          </section>
        </main>
      )}

      {/* DOM overlay: shown on top of the camera view while in AR */}
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
                Keep the square markers in view, 30–60 cm away.
              </div>
            )}
            {debug && status && <pre className={styles.debug}>{debugText(status)}</pre>}
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

function CapabilityNote({ caps }: { caps: ArCapabilities }) {
  const cls = styles.note;
  if (!caps.secureContext) {
    return <p className={cls}>AR needs a secure connection (https:// or localhost).</p>;
  }
  if (!caps.webxr || !caps.immersiveAr) {
    return (
      <p className={cls}>
        AR isn&apos;t available in this browser. On Android, open this page in Chrome (with Google
        Play Services for AR). iPhone support comes via App Clip. You can still explore the exhibit
        in 3D.
      </p>
    );
  }
  if (!caps.imageTracking) {
    return (
      <p className={cls}>
        One more step: image tracking is still an experimental Chrome feature. Open{' '}
        <code>chrome://flags/#webxr-incubations</code>, set <b>WebXR Incubations</b> to Enabled,
        restart Chrome, then reload this page.
      </p>
    );
  }
  return null;
}

function statusText(s: ArStatus | null): string {
  if (!s || s.phase === 'starting') return 'Starting camera…';
  if (s.phase === 'searching') return 'Looking for the mat…';
  if (s.phase === 'holding') return 'Mat out of view';
  const n = s.tracked.length;
  return `Tracking · ${n} marker${n === 1 ? '' : 's'}`;
}

function debugText(s: ArStatus): string {
  const state = (id: string) =>
    s.tracked.includes(id) ? 'T' : s.emulated.includes(id) ? 'e' : '·';
  const res = s.residualByConventionMm;
  return [
    `phase      ${s.phase}   fps ${s.fps.toFixed(0)}`,
    `images     ${s.targets.map((id) => `${id}:${state(id)}`).join(' ')}`,
    `trackable  ${s.trackability ? s.trackability.map((t, i) => `${s.targets[i]}:${t === 'trackable' ? 'ok' : 'NO'}`).join(' ') : 'n/a'}`,
    `fit        ${s.residualMm != null ? `${s.residualMm.toFixed(1)} mm` : '-'}${s.rejected.length ? `  rejected ${s.rejected.join(',')}` : ''}`,
    `axes       ${s.frameConvention ?? '-'}${s.decidedBy ? ` (${s.decidedBy})` : ''} · saved ${s.convention} (${s.conventionSource})`,
    `  residual ${res ? `spec ${res.spec.toFixed(1)}  arcore ${res.arcore.toFixed(1)} mm` : '-'}`,
    `print      ${s.printScale != null ? `${(s.printScale * 100).toFixed(1)} % of expected size` : 'n/a'}`,
  ].join('\n');
}

function arErrorText(e: unknown): string {
  const msg = message(e);
  if (/NotSupported|not supported|Unsupported/i.test(msg)) {
    return `AR couldn't start: ${msg}. On Android make sure Chrome and "Google Play Services for AR" are up to date, and that chrome://flags/#webxr-incubations is enabled.`;
  }
  return `AR couldn't start: ${msg}`;
}

function message(e: unknown): string {
  return e instanceof Error ? `${e.name === 'Error' ? '' : `${e.name}: `}${e.message}` : String(e);
}
