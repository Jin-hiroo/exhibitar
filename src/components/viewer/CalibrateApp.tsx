'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ArRuntime, ArStatus, ExhibitScene, PreparedExhibit } from '@/lib/ar/launch';
import { getBrowserDb } from '@/lib/db/client';
import { saveProject } from '@/lib/db/projects';
import type { Project, ViewerProject } from '@/lib/types';
import styles from './viewer.module.css';

type Calibration = Project['calibration'];
const ZERO: Calibration = { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 };

/**
 * Calibration (ARCHITECTURE §6): the model is drawn as a translucent ghost
 * over the real object; the owner nudges it into place and saves. The
 * correction applies to every visitor.
 */
export function CalibrateApp({
  project,
  assetBase,
}: {
  project: ViewerProject;
  assetBase: string;
}) {
  const [prepared, setPrepared] = useState<PreparedExhibit | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<ArStatus | null>(null);
  const [cal, setCal] = useState<Calibration>(project.calibration);
  const [savedCal, setSavedCal] = useState<Calibration>(project.calibration);
  const [message, setMessage] = useState<string | null>(null);
  const [showY, setShowY] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ArRuntime | null>(null);
  const exhibitRef = useRef<ExhibitScene | null>(null);
  const moduleRef = useRef<typeof import('@/lib/ar/launch') | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/ar/launch')
      .then(async (m) => {
        moduleRef.current = m;
        const p = await m.prepareExhibit(project, assetBase);
        if (!cancelled) setPrepared(p);
      })
      .catch((e: unknown) => !cancelled && setMessage(String(e)));
    return () => {
      cancelled = true;
    };
  }, [project, assetBase]);

  useEffect(() => {
    exhibitRef.current?.setCalibration(cal);
  }, [cal]);

  // leaving the page while calibrating: release the camera
  useEffect(() => () => runtimeRef.current?.stop(), []);

  const start = () => {
    const m = moduleRef.current;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!m || !prepared || !stage || !overlay) return;
    const exhibit = prepared.createScene();
    exhibit.setCalibration(cal);
    exhibitRef.current = exhibit;
    const leave = () => {
      runtimeRef.current = null;
      exhibitRef.current = null;
      exhibit.dispose();
      stage.classList.remove(styles.active!);
      overlay.classList.remove(styles.active!);
      setActive(false);
    };
    let runtime: ArRuntime;
    try {
      runtime = new m.ArRuntime({
        project,
        exhibit,
        container: stage,
        onStatus: setStatus,
        onSelect: () => {},
        onEnd: (err) => {
          leave();
          if (err) setMessage(err);
        },
      });
    } catch (e) {
      exhibit.dispose(); // a mat without tags (made for the old viewer)
      exhibitRef.current = null;
      setMessage(e instanceof Error ? e.message : String(e));
      return;
    }
    runtimeRef.current = runtime;
    stage.classList.add(styles.active!);
    overlay.classList.add(styles.active!);
    setActive(true);
    runtime.setGhost(true);
    runtime.start().catch((e: unknown) => {
      leave();
      setMessage(m.cameraErrorText(e));
    });
  };

  const nudge = (k: keyof Calibration, d: number) =>
    setCal((c) => ({ ...c, [k]: Math.round((c[k] + d) * 100) / 100 }));

  const save = async () => {
    const db = getBrowserDb();
    if (!db) return;
    try {
      const saved = await saveProject(db, project.id, { calibration: cal });
      setSavedCal(saved.calibration);
      setMessage('Saved. Visitors now see this alignment.');
    } catch (e) {
      setMessage(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const changed = JSON.stringify(cal) !== JSON.stringify(savedCal);
  const pad = (label: string, k: keyof Calibration, steps: [number, number], unit: string) => (
    <div className={styles.calRow} data-ui>
      <span>{label}</span>
      <button className={styles.chipButton} onClick={() => nudge(k, -steps[1])}>
        −{steps[1]}
      </button>
      <button className={styles.chipButton} onClick={() => nudge(k, -steps[0])}>
        −{steps[0]}
      </button>
      <b>
        {cal[k].toFixed(k === 'yawDeg' ? 1 : 0)}
        {unit}
      </b>
      <button className={styles.chipButton} onClick={() => nudge(k, steps[0])}>
        +{steps[0]}
      </button>
      <button className={styles.chipButton} onClick={() => nudge(k, steps[1])}>
        +{steps[1]}
      </button>
    </div>
  );

  return (
    <>
      {!active && (
        <main className={styles.page}>
          <section className={styles.card}>
            <span className={styles.eyebrow}>Calibrate</span>
            <h1 className={styles.title}>{project.title}</h1>
            <p className={styles.description}>
              Put the printed object on the mat, start AR, and nudge the blue ghost until it covers
              the real object exactly. Walk around to check from several sides, then save.
            </p>
            <button className={styles.primary} disabled={!prepared} onClick={start}>
              {prepared ? 'Start calibration' : 'Loading…'}
            </button>
            {message && <p className={styles.note}>{message}</p>}
            <Link className={styles.fine} href={`/studio/${project.id}`}>
              Back to the Studio
            </Link>
          </section>
        </main>
      )}
      <div ref={stageRef} className={`${styles.stage} ${active ? styles.active : ''}`} />
      <div ref={overlayRef} className={`${styles.overlay} ${active ? styles.active : ''}`}>
        {active && (
          <>
            <div className={styles.topBar}>
              <button
                className={styles.chipButton}
                data-ui
                onClick={() => runtimeRef.current?.stop()}
              >
                ✕ Done
              </button>
              <span className={styles.chip}>
                {status?.phase === 'tracking' ? 'Tracking the mat' : 'Point at the mat'}
              </span>
            </div>
            <div className={styles.calPanel} data-ui>
              {pad('X ←→', 'dxMm', [1, 5], ' mm')}
              {pad('Z ↑↓ (FRONT)', 'dzMm', [1, 5], ' mm')}
              {pad('Turn', 'yawDeg', [0.5, 2], '°')}
              {showY && pad('Height', 'dyMm', [1, 5], ' mm')}
              <div className={styles.calRow}>
                <button className={styles.chipButton} onClick={() => setShowY((s) => !s)}>
                  {showY ? 'Hide height' : 'Height…'}
                </button>
                <button className={styles.chipButton} onClick={() => setCal(ZERO)}>
                  Reset
                </button>
                <button
                  className={styles.chipButton}
                  aria-pressed={changed}
                  disabled={!changed}
                  onClick={() => void save()}
                >
                  {changed ? 'Save' : 'Saved'}
                </button>
              </div>
              {message && <span className={styles.chip}>{message}</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
