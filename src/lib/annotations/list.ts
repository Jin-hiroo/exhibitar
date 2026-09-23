import { nanoid } from 'nanoid';
import type { Annotation, Vec3 } from '../types';

/** Annotation list editing (TASKS C3). Order doubles as the guided-tour order. */

export function newPoint(anchor: { position: Vec3; normal: Vec3 }, order: number): Annotation {
  return { id: nanoid(8), order, kind: 'point', title: `Point ${order + 1}`, body: '', anchor };
}

export function newRegion(
  anchor: { position: Vec3; normal: Vec3 },
  triangles: number[],
  order: number,
): Annotation {
  return {
    id: nanoid(8),
    order,
    kind: 'region',
    title: `Region ${order + 1}`,
    body: '',
    anchor,
    triangles,
  };
}

export function sorted(list: readonly Annotation[]): Annotation[] {
  return [...list].sort((a, b) => a.order - b.order);
}

/** Re-number `order` 0..n-1 following the current order. */
export function normalizeOrder(list: readonly Annotation[]): Annotation[] {
  return sorted(list).map((a, i) => (a.order === i ? a : { ...a, order: i }));
}

export function update(
  list: readonly Annotation[],
  id: string,
  patch: Partial<Pick<Annotation, 'title' | 'body' | 'link' | 'imagePath' | 'anchor'>> & {
    triangles?: number[];
  },
): Annotation[] {
  return list.map((a) => {
    if (a.id !== id) return a;
    const { triangles, ...rest } = patch;
    const next = { ...a, ...rest } as Annotation;
    if (triangles && next.kind === 'region') return { ...next, triangles };
    return next;
  });
}

export function move(list: readonly Annotation[], id: string, delta: -1 | 1): Annotation[] {
  const s = normalizeOrder(list);
  const i = s.findIndex((a) => a.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= s.length) return s;
  const out = [...s];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out.map((a, k) => ({ ...a, order: k }));
}

export function remove(list: readonly Annotation[], id: string): Annotation[] {
  return normalizeOrder(list.filter((a) => a.id !== id));
}

/** Plain http(s) links only (no javascript: etc.); '' clears. */
export function sanitizeLink(link: string): string | undefined {
  const t = link.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
