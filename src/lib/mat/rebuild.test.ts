import { describe, expect, it } from 'vitest';
import legacyMat from '../../../tests/fixtures/mat.design2.json';
import { cube, toBinaryStl } from '../../../tests/fixtures/shapes';
import { computeFootprint } from '../geometry/footprint';
import { applyOrientation, restingRotation } from '../geometry/orient';
import { parseStl } from '../geometry/parse-stl';
import * as poly from '../geometry/polygons';
import type { Project } from '../types';
import { generateMat } from './generate';
import { MAT_DESIGN_VERSION, matDesignOutdated, rebuildMatInput } from './rebuild';

describe('rebuildMatInput', () => {
  it('rebuilds a stored mat with the new link, same layout, next geometry version', async () => {
    const mesh = parseStl(toBinaryStl(cube())).mesh;
    const fp = await computeFootprint(applyOrientation(mesh, restingRotation([0, 0, -1])).oriented);
    const old = generateMat({
      projectId: 'abc123',
      geometryVersion: 2,
      title: 'Test cube',
      siteUrl: 'http://localhost:3000',
      contactOutlineMm: fp.contactOutlineMm,
      shadowOutlineMm: fp.shadowOutlineMm,
      contactWeak: fp.contactWeak,
      paperPreference: 'us',
    });
    const stored: Project['mat'] = {
      ...old.meta,
      svgPath: 'mats/abc123/mat-v2.svg',
    };

    const input = rebuildMatInput(
      { id: 'abc123', title: 'Test cube', geometryVersion: 2, mat: stored },
      'https://exhibitar.vercel.app',
    );
    expect(input.geometryVersion).toBe(3);
    expect(input.contactWeak).toBe(fp.contactWeak);

    const rebuilt = generateMat(input);
    expect(rebuilt.meta.qrUrl).toBe('https://exhibitar.vercel.app/v/abc123');
    // same sheet and tag positions: only the QR and the version's tag IDs change,
    // so an old print can't be taken for the new mat
    for (const k of ['paper', 'orientation', 'tiles', 'sizeMm'] as const) {
      expect(rebuilt.meta[k]).toEqual(old.meta[k]);
    }
    expect(rebuilt.meta.paper).toBe('Letter');
    expect(rebuilt.meta.tags.map((t) => t.centerMm)).toEqual(old.meta.tags.map((t) => t.centerMm));
    const oldIds = new Set(old.meta.tags.map((t) => t.id));
    expect(rebuilt.meta.tags.filter((t) => oldIds.has(t.id)).length).toBeLessThanOrEqual(3);
  });
});

describe('matDesignOutdated', () => {
  it('flags mats made before the current design (stored without a designVersion)', () => {
    expect(matDesignOutdated({})).toBe(true);
    expect(matDesignOutdated({ designVersion: MAT_DESIGN_VERSION - 1 })).toBe(true);
    expect(matDesignOutdated({ designVersion: MAT_DESIGN_VERSION })).toBe(false);
  });

  it('is false for every newly generated mat', () => {
    const shadow = [poly.rect(-30, -30, 30, 30)];
    const mat = generateMat({
      projectId: 'abc123',
      geometryVersion: 1,
      title: 'T',
      siteUrl: 'https://exhibitar.vercel.app',
      contactOutlineMm: shadow,
      shadowOutlineMm: shadow,
      contactWeak: false,
    });
    expect(mat.meta.designVersion).toBe(MAT_DESIGN_VERSION);
    expect(matDesignOutdated(mat.meta)).toBe(false);
  });
});

describe('a mat stored before design 3 (image markers, no tags)', () => {
  // tests/fixtures/mat.design2.json: the mock project's mat as design 2 stored it
  const legacy = legacyMat as unknown as Project['mat'];

  it('is outdated and rebuilds into a tag mat from its stored outlines', () => {
    expect(legacy.tags).toBeUndefined();
    expect(legacy.markers).toHaveLength(4);
    expect(matDesignOutdated(legacy)).toBe(true);
    const rebuilt = generateMat(
      rebuildMatInput(
        { id: 'mockcube01', title: 'Mock cube', geometryVersion: 1, mat: legacy },
        'https://exhibitar.vercel.app',
      ),
    );
    expect(rebuilt.meta.designVersion).toBe(MAT_DESIGN_VERSION);
    expect(rebuilt.meta.tagFamily).toBe('tag36h11');
    expect(rebuilt.meta.tags.length).toBeGreaterThanOrEqual(12);
    expect('markers' in rebuilt.meta || 'trackImage' in rebuilt.meta).toBe(false);
  });
});
