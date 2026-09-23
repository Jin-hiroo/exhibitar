import type { Project } from '../types';

export type PaperName = Project['mat']['paper'];
export type Orientation = Project['mat']['orientation'];
export type PaperPreference = 'iso' | 'us';

/** Portrait width × height, mm. */
export const PAPER_MM: Record<PaperName, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [215.9, 279.4],
  Tabloid: [279.4, 431.8],
};

/** Most printers can't print closer than this to the sheet edge. */
export const PRINTER_MARGIN_MM = 10;
/** Adjacent tiles overlap by this much so they can be aligned and taped. */
export const TILE_OVERLAP_MM = 10;

export interface Sheet {
  paper: PaperName;
  orientation: Orientation;
  sizeMm: [number, number];
}

export function sheet(paper: PaperName, orientation: Orientation): Sheet {
  const [w, h] = PAPER_MM[paper];
  return { paper, orientation, sizeMm: orientation === 'portrait' ? [w, h] : [h, w] };
}

/** Single sheets to try, smallest first; the orientation matching `aspect` (w/h) first. */
export function sheetCandidates(pref: PaperPreference, aspect: number): Sheet[] {
  const papers: PaperName[] = pref === 'us' ? ['Letter', 'Tabloid'] : ['A4', 'A3'];
  const orients: Orientation[] =
    aspect >= 1 ? ['landscape', 'portrait'] : ['portrait', 'landscape'];
  return papers.flatMap((p) => orients.map((o) => sheet(p, o)));
}

export interface TileWindow {
  col: number;
  row: number;
  /** printable window of this sheet, in mat page mm */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TilePlan extends Sheet {
  cols: number;
  rows: number;
  windows: TileWindow[];
}

export interface Keepout {
  x: number;
  y: number;
  w: number;
  h: number;
  /** how bad it is for a seam to cross this (markers ≫ QR) */
  weight: number;
}

const SHIFT_STEP_MM = 5;

/**
 * Cover a mat of `matMm` with sheets. Each sheet prints a window of
 * (sheet − 2 × margin); neighbours overlap by TILE_OVERLAP_MM, and that
 * overlap strip is where sheets are aligned and trimmed — so the grid is
 * shifted to keep seams off `avoid` (tracking markers above all: a seam
 * through a marker distorts the image the tracker looks for).
 * Priority: seam hits (weighted), then number of sheets, then smaller paper.
 */
export function planTiles(
  matMm: [number, number],
  pref: PaperPreference,
  avoid: Keepout[] = [],
): TilePlan {
  let best: { plan: TilePlan; cost: number; sheets: number; order: number; shift: number } | null =
    null;
  sheetCandidates(pref, 1).forEach((s, order) => {
    const pw = s.sizeMm[0] - 2 * PRINTER_MARGIN_MM;
    const ph = s.sizeMm[1] - 2 * PRINTER_MARGIN_MM;
    const sx = pw - TILE_OVERLAP_MM;
    const sy = ph - TILE_OVERLAP_MM;
    const baseCols = Math.max(1, Math.ceil((matMm[0] - TILE_OVERLAP_MM) / sx));
    const baseRows = Math.max(1, Math.ceil((matMm[1] - TILE_OVERLAP_MM) / sy));
    // single sheet: nothing to shift
    const xShifts = baseCols === 1 ? [0] : range(0, sx, SHIFT_STEP_MM);
    const yShifts = baseRows === 1 ? [0] : range(0, sy, SHIFT_STEP_MM);
    for (const dx of xShifts) {
      for (const dy of yShifts) {
        const cols = Math.max(1, Math.ceil((matMm[0] + dx - TILE_OVERLAP_MM) / sx));
        const rows = Math.max(1, Math.ceil((matMm[1] + dy - TILE_OVERLAP_MM) / sy));
        const seamsX = Array.from({ length: cols - 1 }, (_, c) => (c + 1) * sx - dx);
        const seamsY = Array.from({ length: rows - 1 }, (_, r) => (r + 1) * sy - dy);
        let cost = 0;
        for (const k of avoid) {
          if (seamsX.some((x) => k.x < x + TILE_OVERLAP_MM && x < k.x + k.w)) cost += k.weight;
          if (seamsY.some((y) => k.y < y + TILE_OVERLAP_MM && y < k.y + k.h)) cost += k.weight;
        }
        const sheets = cols * rows;
        const shift = dx + dy;
        const better =
          !best ||
          cost < best.cost ||
          (cost === best.cost &&
            (sheets < best.sheets ||
              (sheets === best.sheets &&
                (order < best.order || (order === best.order && shift < best.shift)))));
        if (!better) continue;
        const windows: TileWindow[] = [];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            windows.push({ col, row, x: col * sx - dx, y: row * sy - dy, w: pw, h: ph });
          }
        }
        best = { plan: { ...s, cols, rows, windows }, cost, sheets, order, shift };
      }
    }
  });
  return best!.plan;
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v < to; v += step) out.push(v);
  return out;
}

/** "A1", "B2", … : column letter + row number. */
export function tileLabel(col: number, row: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}
