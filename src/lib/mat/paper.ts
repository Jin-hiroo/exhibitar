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

/**
 * Cover a mat of `matMm` with the fewest sheets (ties → smaller paper).
 * Each sheet prints a window of (sheet − 2 × margin); neighbours overlap.
 */
export function planTiles(matMm: [number, number], pref: PaperPreference): TilePlan {
  let best: TilePlan | null = null;
  for (const s of sheetCandidates(pref, 1)) {
    const pw = s.sizeMm[0] - 2 * PRINTER_MARGIN_MM;
    const ph = s.sizeMm[1] - 2 * PRINTER_MARGIN_MM;
    const cols = Math.max(1, Math.ceil((matMm[0] - TILE_OVERLAP_MM) / (pw - TILE_OVERLAP_MM)));
    const rows = Math.max(1, Math.ceil((matMm[1] - TILE_OVERLAP_MM) / (ph - TILE_OVERLAP_MM)));
    if (!best || cols * rows < best.cols * best.rows) {
      const windows: TileWindow[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          windows.push({
            col,
            row,
            x: col * (pw - TILE_OVERLAP_MM),
            y: row * (ph - TILE_OVERLAP_MM),
            w: pw,
            h: ph,
          });
        }
      }
      best = { ...s, cols, rows, windows };
    }
  }
  return best!;
}

/** "A1", "B2", … : column letter + row number. */
export function tileLabel(col: number, row: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}
