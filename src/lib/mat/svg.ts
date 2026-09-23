import type { DrawItem } from './display-list';

export interface SvgView {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Render display-list items as a standalone SVG whose physical size is
 * `view.w × view.h` millimetres (1 user unit = 1 mm), so printing at 100 %
 * reproduces the mat exactly.
 */
export function renderSvg(items: DrawItem[], view: SvgView): string {
  const out: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(view.w)}mm" height="${n(view.h)}mm" viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}">`,
    `<rect x="${n(view.x)}" y="${n(view.y)}" width="${n(view.w)}" height="${n(view.h)}" fill="#fff"/>`,
  ];
  for (const it of items) out.push(item(it));
  out.push('</svg>', '');
  return out.join('\n');
}

function item(it: DrawItem): string {
  if (it.kind === 'text') {
    const attrs = [
      `x="${n(it.x)}"`,
      `y="${n(it.y)}"`,
      `font-family="Helvetica, Arial, sans-serif"`,
      `font-size="${n(it.sizeMm)}"`,
      `text-anchor="${it.anchor}"`,
      it.bold ? `font-weight="bold"` : '',
      `fill="${it.fill}"`,
    ].filter(Boolean);
    return `<text ${attrs.join(' ')}>${escapeXml(it.text)}</text>`;
  }
  const d = it.rings
    .filter((r) => r.length > 1)
    .map((r) => `M${r.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}${it.closed ? 'Z' : ''}`)
    .join('');
  const attrs = [
    `d="${d}"`,
    `fill="${it.fill ?? 'none'}"`,
    it.evenOdd ? `fill-rule="evenodd"` : '',
    it.stroke ? `stroke="${it.stroke.color}" stroke-width="${n(it.stroke.widthMm)}"` : '',
    it.stroke?.dashMm ? `stroke-dasharray="${it.stroke.dashMm.map(n).join(' ')}"` : '',
    it.stroke ? `stroke-linejoin="round"` : '',
  ].filter(Boolean);
  return `<path ${attrs.join(' ')}/>`;
}

/** Fixed precision (µm) keeps output small and byte-stable. */
function n(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
