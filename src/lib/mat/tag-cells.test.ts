import { pickTagIds, tagCells } from 'matar';
import { describe, expect, it } from 'vitest';
import { tagBlackRects, tagPoint } from './tag-cells';

describe('tagBlackRects', () => {
  it('covers exactly the black cells of each tag, without overlaps', () => {
    for (const id of [0, ...pickTagIds('tag36h11', 20, 'tag-cells-test')]) {
      const cells = tagCells('tag36h11', id); // 1 = white
      const n = Math.round(Math.sqrt(cells.length));
      const size = 32;
      const cell = size / n;
      const covered = new Uint8Array(n * n);
      for (const [x0, y0, x1, y1] of tagBlackRects('tag36h11', id, size)) {
        for (
          let r = Math.round((y0 + size / 2) / cell);
          r < Math.round((y1 + size / 2) / cell);
          r++
        ) {
          for (
            let c = Math.round((x0 + size / 2) / cell);
            c < Math.round((x1 + size / 2) / cell);
            c++
          ) {
            covered[r * n + c]!++;
          }
        }
      }
      for (let i = 0; i < n * n; i++) expect(covered[i]).toBe(cells[i] === 0 ? 1 : 0);
    }
  });

  it('keeps the black border: the outer cells are black', () => {
    const rects = tagBlackRects('tag36h11', 7, 32);
    const xs = rects.flatMap(([x0, , x1]) => [x0, x1]);
    const ys = rects.flatMap(([, y0, , y1]) => [y0, y1]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      -16, 16, -16, 16,
    ]);
  });
});

describe('tagPoint', () => {
  it('rotates clockwise on the page (y down) about the centre', () => {
    const p = tagPoint({ centerMm: [100, 50], rotationDeg: 90 }, 10, 0);
    expect(p[0]).toBeCloseTo(100, 9);
    expect(p[1]).toBeCloseTo(60, 9);
  });
});
