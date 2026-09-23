import { describe, expect, it } from 'vitest';
import type { DrawItem } from './display-list';
import { gray, rasterizeDrawing } from './raster-drawing';

const at = (r: { width: number; data: Uint8Array }, x: number, y: number) =>
  r.data[y * r.width + x]!;

describe('rasterizeDrawing', () => {
  it('fills shapes with their gray level and skips text', () => {
    const items: DrawItem[] = [
      {
        kind: 'shape',
        closed: true,
        fill: '#000',
        rings: [
          [
            [1, 1],
            [4, 1],
            [4, 4],
            [1, 4],
          ],
        ],
      },
      {
        kind: 'shape',
        closed: true,
        fill: '#e6e6e6',
        rings: [
          [
            [6, 1],
            [9, 1],
            [9, 4],
            [6, 4],
          ],
        ],
      },
      { kind: 'text', x: 5, y: 8, text: 'ignored', sizeMm: 3, anchor: 'start', fill: '#000' },
    ];
    const r = rasterizeDrawing(items, { x: 0, y: 0, w: 10, h: 10 }, 2);
    expect([r.width, r.height]).toEqual([20, 20]);
    expect(at(r, 5, 5)).toBe(0);
    expect(at(r, 15, 5)).toBe(gray('#e6e6e6'));
    expect(at(r, 10, 17)).toBe(255); // text area stays white
  });

  it('draws dashed strokes with gaps', () => {
    const items: DrawItem[] = [
      {
        kind: 'shape',
        closed: false,
        rings: [
          [
            [0, 5],
            [20, 5],
          ],
        ],
        stroke: { color: '#000', widthMm: 1, dashMm: [2, 2] },
      },
    ];
    const r = rasterizeDrawing(items, { x: 0, y: 0, w: 20, h: 10 }, 4);
    const row = Array.from({ length: r.width }, (_, x) => at(r, x, 20));
    expect(row.filter((v) => v < 128).length).toBeGreaterThan(20);
    expect(row.filter((v) => v > 200).length).toBeGreaterThan(20);
  });

  it('parses colours to luminance', () => {
    expect(gray('#fff')).toBe(255);
    expect(gray('#000000')).toBe(0);
    expect(gray('#777')).toBe(119);
  });
});
