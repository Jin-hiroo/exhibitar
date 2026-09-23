import { jsPDF } from 'jspdf';
import type { DrawItem } from './display-list';

export interface PdfPage {
  /** physical page size, mm */
  sizeMm: [number, number];
  /** mat page coordinate shown at the page's top-left corner */
  offsetMm: [number, number];
}

const PT_PER_MM = 72 / 25.4;

/** Render display-list items as a vector PDF, one page per `pages` entry, at actual size. */
export function renderPdf(items: DrawItem[], pages: PdfPage[]): Uint8Array {
  let doc: jsPDF | null = null;
  for (const page of pages) {
    const [w, h] = page.sizeMm;
    const orientation = w > h ? 'landscape' : 'portrait';
    if (!doc) doc = new jsPDF({ unit: 'mm', format: [w, h], orientation, compress: true });
    else doc.addPage([w, h], orientation);
    const [ox, oy] = page.offsetMm;
    for (const it of items) draw(doc, it, ox, oy);
  }
  if (!doc) throw new Error('no pages');
  return new Uint8Array(doc.output('arraybuffer'));
}

function draw(doc: jsPDF, it: DrawItem, ox: number, oy: number): void {
  if (it.kind === 'text') {
    doc.setFont('helvetica', it.bold ? 'bold' : 'normal');
    doc.setFontSize(it.sizeMm * PT_PER_MM);
    doc.setTextColor(it.fill);
    const align = it.anchor === 'start' ? 'left' : it.anchor === 'middle' ? 'center' : 'right';
    doc.text(it.text, it.x - ox, it.y - oy, { align, baseline: 'alphabetic' });
    return;
  }
  const ops: { op: string; c: number[] }[] = [];
  for (const ring of it.rings) {
    if (ring.length < 2) continue;
    ring.forEach(([x, y], i) => ops.push({ op: i === 0 ? 'm' : 'l', c: [x - ox, y - oy] }));
    if (it.closed) ops.push({ op: 'h', c: [] });
  }
  if (!ops.length) return;
  if (it.fill) doc.setFillColor(it.fill);
  if (it.stroke) {
    doc.setDrawColor(it.stroke.color);
    doc.setLineWidth(it.stroke.widthMm);
    doc.setLineDashPattern(it.stroke.dashMm ?? [], 0);
    doc.setLineJoin('round');
  }
  doc.path(ops);
  if (it.fill && it.stroke) {
    if (it.evenOdd) doc.fillStrokeEvenOdd();
    else doc.fillStroke();
  } else if (it.fill) {
    if (it.evenOdd) doc.fillEvenOdd();
    else doc.fill();
  } else {
    doc.stroke();
  }
}
