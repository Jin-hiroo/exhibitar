import { describe, expect, it } from 'vitest';
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
      markers: old.meta.markers.map((m) => ({ ...m, imagePath: '' })),
      trackImage: { ...old.meta.trackImage, imagePath: '' },
    };

    const input = rebuildMatInput(
      { id: 'abc123', title: 'Test cube', geometryVersion: 2, mat: stored },
      'https://exhibitar.vercel.app',
    );
    expect(input.geometryVersion).toBe(3);
    expect(input.contactWeak).toBe(fp.contactWeak);

    const rebuilt = generateMat(input);
    expect(rebuilt.meta.qrUrl).toBe('https://exhibitar.vercel.app/v/abc123');
    // same sheet and outline placement: only the QR (and the version's markers) change
    for (const k of ['paper', 'orientation', 'tiles', 'sizeMm', 'trackImage'] as const) {
      expect(rebuilt.meta[k]).toEqual(old.meta[k]);
    }
    expect(rebuilt.meta.paper).toBe('Letter');
    expect(rebuilt.meta.markers.map((m) => m.centerMm)).toEqual(
      old.meta.markers.map((m) => m.centerMm),
    );
    expect(rebuilt.meta.markers.map((m) => m.seed)).not.toEqual(
      old.meta.markers.map((m) => m.seed),
    );
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
