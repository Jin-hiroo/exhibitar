/**
 * Backend-neutral drawing primitives in page millimetres (x right, y down).
 * The mat is described once as a list of these; `svg.ts` and `pdf.ts` render
 * it, so the SVG and PDF can never disagree.
 */
export type Color = string;

export interface Stroke {
  color: Color;
  widthMm: number;
  dashMm?: number[];
}

export type DrawItem =
  | {
      kind: 'shape';
      /** one or more rings; holes via `evenOdd` */
      rings: [number, number][][];
      closed: boolean;
      fill?: Color;
      stroke?: Stroke;
      evenOdd?: boolean;
      /** semantic tag for tests/debugging, e.g. "marker:m0", "contact" */
      role?: string;
    }
  | {
      kind: 'text';
      x: number;
      /** baseline */
      y: number;
      text: string;
      sizeMm: number;
      anchor: 'start' | 'middle' | 'end';
      bold?: boolean;
      fill: Color;
      role?: string;
    };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectRing({ x, y, w, h }: Rect): [number, number][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/**
 * Advance widths of Helvetica and Helvetica Bold, 1/1000 em, for characters
 * 32–126 (space to `~`): the PDF's built-in font, as jsPDF measures it. The
 * SVG asks for Helvetica, then Arial, which has the same widths.
 */
// prettier-ignore
const HELVETICA = [
  280, 280, 350, 550, 550, 890, 660, 190, 330, 330, 390, 580, 280, 330, 280,
  280, 550, 550, 550, 550, 550, 550, 550, 550, 550, 550, 280, 280, 580, 580,
  580, 550, 1010, 660, 660, 720, 720, 660, 610, 780, 720, 280, 500, 660, 550,
  830, 720, 780, 660, 780, 720, 660, 610, 720, 660, 940, 660, 660, 610, 280,
  280, 280, 470, 550, 330, 550, 550, 500, 550, 550, 280, 550, 550, 220, 220,
  500, 220, 830, 550, 550, 550, 550, 330, 500, 280, 550, 500, 720, 500, 500,
  500, 330, 260, 330, 580,
];
// prettier-ignore
const HELVETICA_BOLD = [
  280, 330, 470, 550, 550, 890, 720, 240, 330, 330, 390, 580, 280, 330, 280,
  280, 550, 550, 550, 550, 550, 550, 550, 550, 550, 550, 330, 330, 580, 580,
  580, 610, 970, 720, 720, 720, 720, 660, 610, 780, 720, 280, 550, 720, 610,
  830, 720, 780, 660, 780, 720, 660, 610, 720, 660, 940, 660, 660, 610, 330,
  280, 330, 580, 550, 330, 550, 610, 550, 610, 550, 330, 610, 610, 280, 280,
  550, 280, 890, 610, 610, 610, 610, 390, 550, 330, 610, 550, 780, 550, 550,
  500, 390, 280, 390, 580,
];

/**
 * Advance width of `text` set in Helvetica (Bold), mm. Other characters
 * (e.g. Japanese) count 1 em, about their width in a fallback font. Layout
 * keeps text out of the tags' white rings with this, so it must not run short:
 * the old 0.6 em per bold character put a title of capitals up to 57 % wider
 * than reserved.
 */
export function textWidthMm(text: string, sizeMm: number, bold = false): number {
  const widths = bold ? HELVETICA_BOLD : HELVETICA;
  let units = 0;
  for (const ch of text) units += widths[(ch.codePointAt(0) ?? 0) - 32] ?? 1000;
  return (units / 1000) * sizeMm;
}
