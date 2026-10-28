import { tagCells } from 'matar';

/** [x0, y0, x1, y1] in mm about a tag's centre: x right, y down on the printed page, unrotated. */
export type CellRect = [number, number, number, number];

/**
 * A matar tag's black cells as rectangles: runs of a row, stacked down while
 * the rows below repeat the run with white or the edge on both sides, so a
 * printer or PDF viewer draws few seams between cells (as matar's `tagSvg`).
 * The black square is `sizeMm` wide; its 1-cell white ring is the paper.
 */
export function tagBlackRects(family: string, id: number, sizeMm: number): CellRect[] {
  const cells = tagCells(family, id); // 1 = white, row-major, y down
  const n = Math.round(Math.sqrt(cells.length));
  const cell = sizeMm / n;
  const black = (r: number, k: number) => cells[r * n + k] === 0;
  const used = new Uint8Array(n * n);
  const rects: CellRect[] = [];
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      if (!black(r, k) || used[r * n + k]) continue;
      let k1 = k;
      while (k1 < n && black(r, k1) && !used[r * n + k1]) k1++;
      const sameRun = (rr: number) => {
        for (let j = k; j < k1; j++) if (!black(rr, j) || used[rr * n + j]) return false;
        const left = k === 0 || !black(rr, k - 1) || used[rr * n + k - 1] === 1;
        const right = k1 === n || !black(rr, k1) || used[rr * n + k1] === 1;
        return left && right;
      };
      let r1 = r + 1;
      while (r1 < n && sameRun(r1)) r1++;
      for (let rr = r; rr < r1; rr++) for (let j = k; j < k1; j++) used[rr * n + j] = 1;
      const h = sizeMm / 2;
      rects.push([k * cell - h, r * cell - h, k1 * cell - h, r1 * cell - h]);
    }
  }
  return rects;
}

/**
 * A point given about a tag's centre (mm, page x right / y down) placed on the
 * mat: rotated clockwise on the page by `rotationDeg`, then moved to the
 * centre. Mat XZ and page coordinates differ only by the origin, so this works
 * for either.
 */
export function tagPoint(
  tag: { centerMm: readonly [number, number]; rotationDeg: number },
  x: number,
  y: number,
): [number, number] {
  const a = (tag.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [tag.centerMm[0] + x * c - y * s, tag.centerMm[1] + x * s + y * c];
}
