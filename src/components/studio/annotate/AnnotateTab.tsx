'use client';

import { useMemo, useRef, useState } from 'react';
import {
  move,
  newPoint,
  newRegion,
  remove,
  sanitizeLink,
  sorted,
  update,
} from '@/lib/annotations/list';
import {
  applyBrush,
  buildTriangleSpatial,
  regionAnchor,
  trianglesTouchingSphere,
} from '@/lib/annotations/region';
import { toProject } from '@/lib/db/mapping';
import type { Annotation, Vec3 } from '@/lib/types';
import { mmToM } from '@/lib/units';
import styles from '@/app/studio/studio.module.css';
import type { EditorContext } from '../Editor';
import { geometryArrays } from '../model-geometry';
import { AnnotateView, type Tool } from './AnnotateView';

/** C1–C3: points, painted regions, and the annotation list (order = tour order). */
export function AnnotateTab({ ctx }: { ctx: EditorContext }) {
  const { project, setProject, geometry } = ctx;
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [brushMm, setBrushMm] = useState(8);
  const [erase, setErase] = useState(false);
  const [stroke, setStroke] = useState<number[] | null>(null);
  const strokeRef = useRef<number[]>([]);

  const arrays = useMemo(() => (geometry ? geometryArrays(geometry) : null), [geometry]);
  const spatial = useMemo(
    () => (arrays ? buildTriangleSpatial(arrays.positions, arrays.indices) : null),
    [arrays],
  );
  // stable while painting (only text/annotation edits rebuild the label scene)
  const viewProject = useMemo(() => {
    const full = toProject(project);
    return full ? { ...full, annotations: sorted(full.annotations) } : null;
  }, [project]);
  const list = sorted(project.annotations);
  const selectedAnn = list.find((a) => a.id === selected) ?? null;
  const setList = (next: Annotation[]) => setProject((p) => ({ ...p, annotations: next }));

  if (!viewProject || !geometry || !arrays || !spatial) return null;

  const onPick = (anchor: { position: Vec3; normal: Vec3 }) => {
    const a = newPoint(anchor, list.length);
    setList([...project.annotations, a]);
    setSelected(a.id);
    setTool('select');
  };

  const onPaint = (point: Vec3, phase: 'start' | 'move' | 'end') => {
    const dab = trianglesTouchingSphere(spatial, point, mmToM(brushMm));
    if (phase === 'start') {
      const base = selectedAnn?.kind === 'region' ? selectedAnn.triangles : [];
      strokeRef.current = applyBrush(base, dab, erase ? 'erase' : 'add');
    } else {
      strokeRef.current = applyBrush(strokeRef.current, dab, erase ? 'erase' : 'add');
    }
    setStroke(strokeRef.current);
    if (phase !== 'end') return;
    const tris = strokeRef.current;
    const anchor = regionAnchor(arrays.positions, arrays.indices, tris);
    setStroke(null);
    if (!anchor) return;
    if (selectedAnn?.kind === 'region') {
      setList(update(project.annotations, selectedAnn.id, { triangles: tris, anchor }));
    } else {
      const a = newRegion(anchor, tris, list.length);
      setList([...project.annotations, a]);
      setSelected(a.id);
    }
  };

  const paintTriangles = stroke ?? (selectedAnn?.kind === 'region' ? selectedAnn.triangles : []);

  return (
    <div className={styles.split}>
      <div className={styles.viewport}>
        <AnnotateView
          project={viewProject}
          geometry={geometry}
          tool={tool}
          selected={selected}
          paintTriangles={paintTriangles}
          onPick={onPick}
          onPaint={onPaint}
          onSelect={setSelected}
        />
        <div className={styles.overlayTools}>
          <button
            className={styles.tool}
            aria-pressed={tool === 'select'}
            onClick={() => setTool('select')}
          >
            ✋ Move / select
          </button>
          <button
            className={styles.tool}
            aria-pressed={tool === 'point'}
            onClick={() => setTool('point')}
          >
            ＋ Point
          </button>
          <button
            className={styles.tool}
            aria-pressed={tool === 'paint'}
            onClick={() => setTool('paint')}
            title={
              selectedAnn?.kind === 'region' ? 'Paint the selected region' : 'Paint a new region'
            }
          >
            🖌 {selectedAnn?.kind === 'region' ? 'Paint region' : 'New region'}
          </button>
          {tool === 'paint' && (
            <>
              <button
                className={styles.tool}
                aria-pressed={erase}
                onClick={() => setErase((x) => !x)}
              >
                Erase
              </button>
              <label className={styles.tool}>
                Brush {brushMm} mm{' '}
                <input
                  type="range"
                  min={2}
                  max={40}
                  value={brushMm}
                  onChange={(e) => setBrushMm(Number(e.target.value))}
                />
              </label>
            </>
          )}
        </div>
      </div>

      <aside className={styles.panel}>
        <p className={styles.small}>
          {tool === 'point'
            ? 'Click the model to place a point.'
            : tool === 'paint'
              ? 'Drag over the model to paint. Switch to Move to rotate the view.'
              : 'Drag to rotate, scroll to zoom. Click a label to select it.'}
        </p>
        {list.length === 0 && <p className={styles.muted}>No annotations yet.</p>}
        <ul className={styles.list}>
          {list.map((a, i) => (
            <li
              key={a.id}
              className={styles.annotation}
              data-selected={a.id === selected}
              onClick={() => setSelected(a.id)}
            >
              <div className={styles.row}>
                <strong>{i + 1}</strong>
                <span className={styles.small} style={{ flex: 1 }}>
                  {a.kind === 'region' ? `Region · ${a.triangles.length} triangles` : 'Point'}
                </span>
                <button
                  className={styles.ghost}
                  aria-label="Move up"
                  onClick={() => setList(move(project.annotations, a.id, -1))}
                >
                  ↑
                </button>
                <button
                  className={styles.ghost}
                  aria-label="Move down"
                  onClick={() => setList(move(project.annotations, a.id, 1))}
                >
                  ↓
                </button>
                <button
                  className={styles.ghost}
                  aria-label="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selected === a.id) setSelected(null);
                    setList(remove(project.annotations, a.id));
                  }}
                >
                  ✕
                </button>
              </div>
              {a.id === selected && (
                <>
                  <label className={styles.field}>
                    <span>Title</span>
                    <input
                      value={a.title}
                      maxLength={120}
                      onChange={(e) =>
                        setList(update(project.annotations, a.id, { title: e.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Text</span>
                    <textarea
                      value={a.body}
                      maxLength={4000}
                      onChange={(e) =>
                        setList(update(project.annotations, a.id, { body: e.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Link (optional)</span>
                    <input
                      defaultValue={a.link ?? ''}
                      placeholder="https://…"
                      onBlur={(e) =>
                        setList(
                          update(project.annotations, a.id, { link: sanitizeLink(e.target.value) }),
                        )
                      }
                    />
                  </label>
                  {a.kind === 'region' && (
                    <button className={styles.secondary} onClick={() => setTool('paint')}>
                      🖌 Paint this region
                    </button>
                  )}
                </>
              )}
              {a.id !== selected && <span>{a.title}</span>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
