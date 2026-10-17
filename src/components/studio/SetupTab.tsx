'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { restingRotation } from '@/lib/geometry/rotation';
import { formatDimsMm, sourceScaleFor } from '@/lib/geometry/scale';
import type { PaperPreference } from '@/lib/mat/paper';
import { siteUrl } from '@/lib/db/env';
import { UNIT_TO_MM, type LengthUnit } from '@/lib/units';
import type { Annotation } from '@/lib/types';
import styles from '@/app/studio/studio.module.css';
import type { EditorContext } from './Editor';

// three.js / R3F load only once there is a model to show
const ModelPreview = dynamic(() => import('./ModelPreview').then((m) => m.ModelPreview), {
  ssr: false,
});

const SAMPLES = [
  { file: 'cube.stl', label: '60 mm cube' },
  { file: 'sphere-on-flat.stl', label: 'Sphere on a flat' },
  { file: 'l-block.stl', label: 'L-block' },
  { file: 'tripod.stl', label: 'Tripod' },
];

export function SetupTab({ ctx }: { ctx: EditorContext }) {
  const { project, setProject, geo, setGeo } = ctx;
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [paper, setPaper] = useState<PaperPreference>('iso');

  const load = async (
    stl: ArrayBuffer,
    fileName: string,
    unit: LengthUnit,
    uniformScale: number,
  ) => {
    setError(null);
    setBusy('Reading the STL…');
    setProgress(0.1);
    try {
      // keep our own copy: the worker gets a transferred one (the STL never leaves this browser)
      const copy = stl.slice(0);
      const loaded = await ctx.geometryClient.call(
        'load',
        { stl: copy, sourceScale: sourceScaleFor(unit, uniformScale) },
        { transfer: [copy], onProgress: (_s, f) => setProgress(0.1 + 0.8 * f) },
      );
      const asPrinted = loaded.candidates.findIndex((c) => c.asPrinted);
      setGeo({
        stl,
        fileName,
        unit,
        uniformScale,
        loaded,
        candidate:
          0 <= asPrinted && loaded.candidates[asPrinted]!.score >= loaded.candidates[0]!.score * 0.8
            ? asPrinted
            : 0,
        frontYawDeg: 0,
      });
      if (!project.title) {
        setProject((p) => ({
          ...p,
          title: fileName.replace(/\.stl$/i, '').replace(/[-_]+/g, ' '),
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    await load(await file.arrayBuffer(), file.name, geo?.unit ?? 'mm', geo?.uniformScale ?? 1);
  };

  const loadSample = async (file: string) => {
    const res = await fetch(`/samples/${file}`);
    await load(await res.arrayBuffer(), file, 'mm', 1);
  };

  const candidate = geo?.loaded.candidates[geo.candidate];
  const rotation = candidate ? restingRotation(candidate.normal, geo!.frontYawDeg) : null;

  const generate = async () => {
    if (!geo || !rotation) return;
    const regions = project.annotations.filter((a) => a.kind === 'region' && a.triangles.length);
    if (
      regions.length &&
      !window.confirm(
        'A new model means a new mesh: painted regions will be cleared (their text is kept). Continue?',
      )
    ) {
      return;
    }
    setError(null);
    setBusy('Simplifying the model and computing outlines…');
    setProgress(0.1);
    try {
      const prepared = await ctx.geometryClient.call(
        'prepare',
        { meshMm: geo.loaded.meshMm, rotation },
        { onProgress: (_s, f) => setProgress(0.1 + 0.6 * f) },
      );
      setBusy('Generating the placement mat…');
      setProgress(0.75);
      // a new geometry gets a new version (and therefore new markers and a new mat)
      const geometryVersion = project.geometryVersion + 1;
      const mat = await ctx.matClient.call('generate', {
        projectId: project.id,
        geometryVersion,
        title: project.title || 'Exhibit',
        siteUrl: siteUrl(),
        contactOutlineMm: prepared.footprint.contactOutlineMm,
        shadowOutlineMm: prepared.footprint.shadowOutlineMm,
        contactWeak: prepared.footprint.contactWeak,
        paperPreference: paper,
      });
      const blobUrl = (data: Uint8Array | string, type: string) =>
        URL.createObjectURL(
          new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type }),
        );
      const urls: Record<string, string> = {
        svg: blobUrl(mat.svg, 'image/svg+xml'),
        pdf: blobUrl(mat.pdf, 'application/pdf'),
        qr: blobUrl(mat.qrPng, 'image/png'),
        track: blobUrl(mat.trackPng, 'image/png'),
      };
      for (const m of mat.markerPngs) urls[m.id] = blobUrl(m.png, 'image/png');

      ctx.setReady({ prepared, mat, geometryVersion, urls });
      setProject((p) => ({
        ...p,
        geometryVersion,
        // storage paths are filled in on publish
        model: {
          glbPath: '',
          triangleCount: prepared.triangleCount,
          boundsMm: { size: prepared.boundsMm.size },
          sourceScale: geo.loaded.sourceScale,
        },
        objectToMat: prepared.objectToMat,
        mat: {
          ...mat.meta,
          svgPath: '',
          markers: mat.meta.markers.map((m) => ({ ...m, imagePath: '' })),
          trackImage: { ...mat.meta.trackImage, imagePath: '' },
        },
        annotations: p.annotations.map((a): Annotation =>
          a.kind === 'region' ? { ...a, triangles: [] } : a,
        ),
      }));
      ctx.setTab('mat');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.split}>
      <div className={styles.viewport}>
        {geo && rotation ? (
          <ModelPreview mesh={geo.loaded.previewMm} rotation={rotation} />
        ) : (
          <div
            className={styles.drop}
            style={{ height: '100%', alignContent: 'center' }}
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void onFile(e.dataTransfer.files[0]);
            }}
          >
            <strong>Drop an STL file here</strong>
            <span className={styles.small}>
              Binary or ASCII. It is processed in your browser and never uploaded.
            </span>
            <label className={styles.primary}>
              Choose file…
              <input
                type="file"
                accept=".stl,model/stl"
                hidden
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            <span className={styles.small}>or try a sample:</span>
            <div className={styles.row} style={{ justifyContent: 'center' }}>
              {SAMPLES.map((s) => (
                <button
                  key={s.file}
                  className={styles.secondary}
                  onClick={() => void loadSample(s.file)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className={styles.panel}>
        <label className={styles.field}>
          <span>Title</span>
          <input
            value={project.title}
            maxLength={200}
            onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Neanderthal skull"
          />
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea
            value={project.description ?? ''}
            maxLength={5000}
            onChange={(e) =>
              setProject((p) => ({ ...p, description: e.target.value || undefined }))
            }
            placeholder="Shown on the visitor's landing card"
          />
        </label>

        {busy && (
          <div className={styles.panel}>
            <span className={styles.small}>{busy}</span>
            <div className={styles.progress}>
              <div style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}

        {geo && (
          <>
            <div className={styles.row}>
              <strong style={{ flex: 1 }}>{geo.fileName}</strong>
              <label className={styles.ghost}>
                Replace…
                <input
                  type="file"
                  accept=".stl"
                  hidden
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </label>
            </div>
            <span className={styles.small}>
              {formatDimsMm(geo.loaded.boundsMm.size)} ·{' '}
              {geo.loaded.stats.triangles.toLocaleString()} triangles
            </span>
            {geo.loaded.warnings.map((w) => (
              <p key={w} className={styles.warning}>
                {w}
              </p>
            ))}

            <div className={styles.row}>
              <label className={styles.field} style={{ flex: 1 }}>
                <span>Units in the file</span>
                <select
                  value={geo.unit}
                  onChange={(e) =>
                    void load(geo.stl, geo.fileName, e.target.value as LengthUnit, geo.uniformScale)
                  }
                >
                  {(Object.keys(UNIT_TO_MM) as LengthUnit[]).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field} style={{ width: 110 }}>
                <span>Scale</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  defaultValue={geo.uniformScale}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v !== geo.uniformScale)
                      void load(geo.stl, geo.fileName, geo.unit, v);
                  }}
                />
              </label>
            </div>
            <p className={styles.small}>Print the object at this same size.</p>

            <div className={styles.field}>
              <span>Resting face</span>
              <ul className={styles.list} role="radiogroup">
                {geo.loaded.candidates.slice(0, 6).map((c, i) => (
                  <li
                    key={i}
                    role="radio"
                    aria-checked={geo.candidate === i}
                    tabIndex={0}
                    className={styles.option}
                    onClick={() => setGeo({ ...geo, candidate: i })}
                    onKeyDown={(e) => e.key === 'Enter' && setGeo({ ...geo, candidate: i })}
                  >
                    <strong>{i + 1}</strong>
                    <span>
                      {Math.round(c.contactAreaMm2).toLocaleString()} mm² on the table
                      {c.asPrinted ? ' · as printed' : ''}
                      {c.stable ? '' : ' · tips over'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.field}>
              <span>FRONT (faces the visitor): {Math.round(geo.frontYawDeg)}°</span>
              <div className={styles.row}>
                <button
                  className={styles.secondary}
                  onClick={() => setGeo({ ...geo, frontYawDeg: wrap(geo.frontYawDeg - 90) })}
                >
                  ↺ 90°
                </button>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={geo.frontYawDeg}
                  style={{ flex: 1 }}
                  onChange={(e) => setGeo({ ...geo, frontYawDeg: Number(e.target.value) })}
                />
                <button
                  className={styles.secondary}
                  onClick={() => setGeo({ ...geo, frontYawDeg: wrap(geo.frontYawDeg + 90) })}
                >
                  ↻ 90°
                </button>
              </div>
            </div>

            <label className={styles.field}>
              <span>Paper</span>
              <select value={paper} onChange={(e) => setPaper(e.target.value as PaperPreference)}>
                <option value="iso">A4 / A3</option>
                <option value="us">Letter / Tabloid</option>
              </select>
            </label>

            <button className={styles.primary} disabled={!!busy} onClick={() => void generate()}>
              {project.model ? 'Regenerate model & mat' : 'Generate model & mat'}
            </button>
            {project.status === 'published' && project.model && (
              <p className={styles.warning}>
                This exhibit is published. A new model or orientation creates a new mat: the printed
                mat stops working until you print the new one.
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
