import { describe, expect, it } from 'vitest';
import { buildMarker, generateMarkerArt, MARKER_PX, pickMarkers } from './markers';
import { encodePng } from './png';
import { distinctness } from './quality';
import { createRaster, fillPolygon } from './raster';

describe('marker generator', () => {
  it('is deterministic: same seed → identical art and PNG bytes', () => {
    const a = buildMarker(42);
    const b = buildMarker(42);
    expect(a.art).toEqual(b.art);
    expect(Buffer.from(a.png).equals(Buffer.from(b.png))).toBe(true);
    expect(buildMarker(43).art).not.toEqual(a.art);
  });

  it('produces a valid, small PNG of the right size', () => {
    const m = buildMarker(7);
    expect(Array.from(m.png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const v = new DataView(m.png.buffer, m.png.byteOffset);
    expect(v.getUint32(16)).toBe(MARKER_PX);
    expect(v.getUint32(20)).toBe(MARKER_PX);
    expect(m.png.byteLength).toBeLessThan(200 * 1024);
  });

  it('keeps art inside the unit square', () => {
    for (const s of generateMarkerArt(99).shapes) {
      for (const [x, y] of s.rings.flat()) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('picks mutually distinct, high-quality markers', () => {
    const ms = pickMarkers(1000, 4);
    expect(ms).toHaveLength(4);
    for (const m of ms) {
      expect(m.quality.ok).toBe(true);
      expect(m.quality.corners).toBeGreaterThanOrEqual(60);
    }
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        expect(distinctness(ms[i]!.raster, ms[j]!.raster)).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it('most seeds pass the quality bar', () => {
    let ok = 0;
    for (let s = 0; s < 20; s++) if (buildMarker(s).quality.ok) ok++;
    expect(ok).toBeGreaterThanOrEqual(12);
  });
});

describe('quality check', () => {
  it('rejects a symmetric, featureless image', async () => {
    const { assessMarker } = await import('./quality');
    const r = createRaster(512, 512);
    fillPolygon(
      r,
      [
        [
          [64, 64],
          [448, 64],
          [448, 448],
          [64, 448],
        ],
      ],
      0,
    );
    const q = assessMarker(r);
    expect(q.ok).toBe(false);
    expect(q.asymmetry).toBeLessThan(0.05);
  });

  it('encodes an arbitrary raster', () => {
    const r = createRaster(3, 2, 128);
    expect(encodePng(r).byteLength).toBeGreaterThan(8 + 25 + 12);
  });
});
