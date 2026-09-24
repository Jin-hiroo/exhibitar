import { describe, expect, it } from 'vitest';
import { cube, toBinaryStl } from '../../../tests/fixtures/shapes';
import { newPoint } from '@/lib/annotations/list';
import type { Db } from '@/lib/db/client';
import type { ProjectRow } from '@/lib/db/database.types';
import { restingRotation } from '@/lib/geometry/orient';
import { loadModel, prepareModel } from '@/lib/geometry/pipeline';
import { generateMat } from '@/lib/mat/generate';
import { rebuildMatInput } from '@/lib/mat/rebuild';
import { newStudioProject } from './draft';
import type { PreparedSession } from './Editor';
import { saveToCloud } from './publish';

/** Just enough of the Supabase client for saveToCloud, recording every call. */
function fakeDb() {
  const rows = new Map<string, ProjectRow>();
  const uploads: { bucket: string; path: string; type: string; size: number }[] = [];
  const ops: string[] = [];
  const toRow = (id: string, patch: Partial<ProjectRow>): ProjectRow => ({
    id,
    owner_id: 'owner',
    title: '',
    description: null,
    status: 'draft',
    geometry_version: 1,
    model: null,
    object_to_mat: null,
    calibration: { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 },
    mat: null,
    annotations: [],
    view_count: 0,
    published_at: null,
    created_at: 'now',
    updated_at: 'now',
    ...patch,
  });
  const db = {
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => ({ data: rows.get(id) ?? null, error: null }),
        }),
      }),
      insert: (v: { id: string; title: string }) => ({
        select: () => ({
          single: async () => {
            ops.push('insert');
            rows.set(v.id, toRow(v.id, { title: v.title }));
            return { data: rows.get(v.id), error: null };
          },
        }),
      }),
      update: (u: Partial<ProjectRow>) => ({
        eq: (_c: string, id: string) => ({
          select: () => ({
            single: async () => {
              ops.push('update');
              rows.set(id, { ...rows.get(id)!, ...u });
              return { data: rows.get(id), error: null };
            },
          }),
        }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: Blob, opts: { contentType: string }) => {
          ops.push(`upload ${bucket}`);
          uploads.push({ bucket, path, type: opts.contentType, size: body.size });
          return { error: null };
        },
      }),
    },
  };
  return { db: db as unknown as Db, rows, uploads, ops };
}

async function readySession(projectId: string, geometryVersion: number): Promise<PreparedSession> {
  const loaded = await loadModel(toBinaryStl(cube()), 1);
  const prepared = await prepareModel(loaded.meshMm, restingRotation([0, 0, -1]));
  const mat = generateMat({
    projectId,
    geometryVersion,
    title: 'Cube',
    siteUrl: 'https://exhibitar.vercel.app',
    contactOutlineMm: prepared.footprint.contactOutlineMm,
    shadowOutlineMm: prepared.footprint.shadowOutlineMm,
    contactWeak: prepared.footprint.contactWeak,
  });
  return { prepared, mat, geometryVersion, urls: {} };
}

describe('saveToCloud', () => {
  it('creates the row, uploads versioned assets (never the STL) and publishes', async () => {
    const { db, rows, uploads, ops } = fakeDb();
    const ready = await readySession('cube000001', 2);
    const point = newPoint({ position: [0, 0, 0.06], normal: [0, 0, 1] }, 0);
    const project = {
      ...newStudioProject('cube000001', 'owner'),
      title: 'Cube',
      geometryVersion: 2,
      model: {
        glbPath: '',
        triangleCount: 12,
        boundsMm: { size: [60, 60, 60] as [number, number, number] },
        sourceScale: 1,
      },
      annotations: [point],
    };
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' });

    const saved = await saveToCloud(db, project, ready, 'published', () => {}, {
      [point.id]: image,
    });

    // order: create the row (storage RLS needs it), upload, then write the row
    expect(ops[0]).toBe('insert');
    expect(ops[ops.length - 1]).toBe('update');
    const paths = uploads.map((u) => `${u.bucket}/${u.path}`);
    expect(paths).toContain('models/cube000001/model-v2.glb');
    expect(paths).toContain('mats/cube000001/mat-v2.svg');
    expect(paths).toContain('mats/cube000001/mat-v2.pdf');
    expect(paths).toContain('mats/cube000001/qr-v2.png');
    expect(paths).toContain('mats/cube000001/track-v2.png');
    expect(paths.filter((p) => /marker-v2-m\d\.png$/.test(p))).toHaveLength(4);
    expect(paths.some((p) => p.startsWith(`annotation-media/cube000001/${point.id}-`))).toBe(true);
    expect(uploads.every((u) => u.type !== 'model/stl' && !u.path.endsWith('.stl'))).toBe(true);
    expect(uploads.find((u) => u.path.endsWith('.glb'))!.type).toBe('model/gltf-binary');

    const row = rows.get('cube000001')!;
    expect(row.status).toBe('published');
    expect(row.geometry_version).toBe(2);
    expect((row.model as { glbPath: string }).glbPath).toBe('models/cube000001/model-v2.glb');
    const mat = row.mat as {
      svgPath: string;
      markers: { imagePath: string }[];
      trackImage: { imagePath: string };
      qrUrl: string;
    };
    expect(mat.svgPath).toBe('mats/cube000001/mat-v2.svg');
    expect(mat.qrUrl).toBe('https://exhibitar.vercel.app/v/cube000001');
    expect(
      mat.markers.every((m) => /^mats\/cube000001\/marker-v2-m\d\.png$/.test(m.imagePath)),
    ).toBe(true);
    expect(mat.trackImage.imagePath).toBe('mats/cube000001/track-v2.png');
    expect(saved.annotations[0]!.imagePath).toMatch(/^annotation-media\/cube000001\//);
  });

  it('rebuilds the mat for a new link without re-uploading the model', async () => {
    const { db, rows, uploads } = fakeDb();
    const project = { ...newStudioProject('cube000005', 'owner'), title: 'Cube' };
    const first = await saveToCloud(
      db,
      project,
      await readySession('cube000005', 2),
      'published',
      () => {},
    );
    const before = uploads.length;

    const input = rebuildMatInput({ ...first, mat: first.mat! }, 'https://exhibit.example');
    const saved = await saveToCloud(
      db,
      first,
      { geometryVersion: input.geometryVersion, mat: generateMat(input) },
      'published',
      () => {},
    );

    const paths = uploads.slice(before).map((u) => `${u.bucket}/${u.path}`);
    expect(paths.some((p) => p.endsWith('.glb'))).toBe(false);
    expect(paths).toContain('mats/cube000005/qr-v3.png');
    expect(paths).toContain('mats/cube000005/mat-v3.pdf');
    const row = rows.get('cube000005')!;
    expect(row.geometry_version).toBe(3);
    expect((row.model as { glbPath: string }).glbPath).toBe('models/cube000005/model-v2.glb');
    expect(saved.mat!.qrUrl).toBe('https://exhibit.example/v/cube000005');
    expect(saved.mat!.svgPath).toBe('mats/cube000005/mat-v3.svg');
  });

  it('saves text-only edits without re-uploading geometry', async () => {
    const { db, uploads } = fakeDb();
    const project = { ...newStudioProject('cube000002', 'owner'), title: 'Renamed' };
    const saved = await saveToCloud(db, project, null, 'draft', () => {});
    expect(uploads).toHaveLength(0);
    expect(saved.title).toBe('Renamed');
  });

  it('refuses to publish without a model', async () => {
    const { db } = fakeDb();
    const project = { ...newStudioProject('cube000003', 'owner'), title: 'Empty' };
    await expect(saveToCloud(db, project, null, 'published', () => {})).rejects.toThrow(
      /before publishing/,
    );
  });

  it('rejects unsupported annotation images before writing anything', async () => {
    const { db, ops } = fakeDb();
    const point = newPoint({ position: [0, 0, 0], normal: [0, 0, 1] }, 0);
    const project = {
      ...newStudioProject('cube000004', 'owner'),
      title: 'X',
      annotations: [point],
    };
    const gif = new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' });
    await expect(
      saveToCloud(db, project, null, 'draft', () => {}, { [point.id]: gif }),
    ).rejects.toThrow(/PNG, JPEG or WebP/);
    expect(ops).toEqual([]);
  });
});
