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

/** Rough advance width of Helvetica-like text, for layout only. */
export function textWidthMm(text: string, sizeMm: number, bold = false): number {
  return text.length * sizeMm * (bold ? 0.6 : 0.55);
}
