import QRCode from 'qrcode';
import type { DrawItem } from './display-list';
import { encodePng } from './png';
import { createRaster } from './raster';

/** QR quiet zone, in modules (ISO/IEC 18004). */
export const QR_QUIET_MODULES = 4;

/** Public Viewer URL printed into the mat's QR code (launch only, never tracked). */
export function viewerUrl(siteUrl: string, projectId: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/v/${encodeURIComponent(projectId)}`;
}

interface Modules {
  size: number;
  dark(row: number, col: number): boolean;
}

function modules(text: string): Modules {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: qr.modules.size, dark: (r, c) => qr.modules.get(r, c) === 1 };
}

/**
 * Vector QR symbol as one filled shape (horizontal runs merged into rects).
 * `(x, y)` is the symbol's top-left corner and `sizeMm` its edge length,
 * excluding the quiet zone (the caller keeps that area clear).
 */
export function qrDrawItems(text: string, x: number, y: number, sizeMm: number): DrawItem[] {
  const m = modules(text);
  const px = sizeMm / m.size;
  const rings: [number, number][][] = [];
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!m.dark(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < m.size && m.dark(r, c)) c++;
      const x0 = x + start * px;
      const x1 = x + c * px;
      const y0 = y + r * px;
      const y1 = y0 + px;
      rings.push([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]);
    }
  }
  return [{ kind: 'shape', rings, closed: true, fill: '#000', role: 'qr' }];
}

/** Number of modules along one edge (without quiet zone). */
export function qrModuleCount(text: string): number {
  return modules(text).size;
}

/** QR code as a grayscale PNG with quiet zone, for download. */
export function qrPng(text: string, pxPerModule = 10): Uint8Array {
  const m = modules(text);
  const n = (m.size + 2 * QR_QUIET_MODULES) * pxPerModule;
  const r = createRaster(n, n, 255);
  for (let row = 0; row < m.size; row++) {
    for (let col = 0; col < m.size; col++) {
      if (!m.dark(row, col)) continue;
      const y0 = (row + QR_QUIET_MODULES) * pxPerModule;
      const x0 = (col + QR_QUIET_MODULES) * pxPerModule;
      for (let y = y0; y < y0 + pxPerModule; y++)
        r.data.fill(0, y * n + x0, y * n + x0 + pxPerModule);
    }
  }
  return encodePng(r);
}
