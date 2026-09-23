import type { Polygons } from '../geometry/polygons';
import { rectRing, type DrawItem, type Rect } from './display-list';
import type { MatLayout } from './layout';
import { MARKER_QUIET_MM, QR_SIZE_MM, SUBTITLE, SUBTITLE_SIZE_MM } from './layout';
import type { MarkerArt } from './markers';
import { tileLabel, TILE_OVERLAP_MM } from './paper';
import { qrDrawItems } from './qr';

const BLACK = '#000';
const WHITE = '#fff';
const GRAY = '#777';
const CONTACT_FILL = '#e6e6e6';

export interface DrawingInput {
  layout: MatLayout;
  /** mat XZ, mm */
  contactOutlineMm: Polygons;
  shadowOutlineMm: Polygons;
  contactWeak: boolean;
  /** one per layout marker slot */
  markerArts: MarkerArt[];
  title: string;
  qrText: string;
}

/** Everything printed on the mat, in page mm, back to front. */
export function buildMatDrawing(d: DrawingInput): DrawItem[] {
  const { layout: l } = d;
  const toPage = (polys: Polygons) =>
    polys.map((r) => r.map(([x, y]) => [x + l.originMm[0], y + l.originMm[1]] as [number, number]));
  const items: DrawItem[] = [];

  // Object outlines: dashed shadow, then the solid (lightly filled) contact.
  items.push({
    kind: 'shape',
    role: 'shadow',
    rings: toPage(d.shadowOutlineMm),
    closed: true,
    stroke: d.contactWeak
      ? { color: BLACK, widthMm: 0.8, dashMm: [4, 1.5] }
      : { color: BLACK, widthMm: 0.4, dashMm: [3, 2] },
  });
  if (d.contactOutlineMm.length) {
    items.push({
      kind: 'shape',
      role: 'contact',
      rings: toPage(d.contactOutlineMm),
      closed: true,
      evenOdd: true,
      fill: CONTACT_FILL,
      stroke: { color: BLACK, widthMm: 0.6 },
    });
  }

  l.markers.forEach((slot, i) => {
    const art = d.markerArts[i];
    if (!art) throw new Error(`missing art for marker ${i}`);
    items.push(...markerItems(art, slot.center, slot.widthMm, slot.rotationDeg, `marker:m${i}`));
  });

  items.push(...frontArrow(l.front.x + l.front.w / 2, l.front.y));
  items.push(...ruler(l.ruler.x, l.ruler.y));
  items.push(...qrDrawItems(d.qrText, l.qr.x, l.qr.y, QR_SIZE_MM));
  items.push(
    text(
      l.qr.x + QR_SIZE_MM / 2,
      l.qr.y + QR_SIZE_MM + 4.5,
      'Scan for AR',
      3,
      'middle',
      'qr-caption',
    ),
  );

  if (l.title) {
    const { rect, sizeMm } = l.title;
    const cx = rect.x + rect.w / 2;
    items.push({ ...text(cx, rect.y + sizeMm, d.title, sizeMm, 'middle', 'title'), bold: true });
    items.push({
      ...text(
        cx,
        rect.y + sizeMm + 2 + SUBTITLE_SIZE_MM,
        SUBTITLE,
        SUBTITLE_SIZE_MM,
        'middle',
        'subtitle',
      ),
      fill: GRAY,
    });
  }

  if (l.tilePlan) items.push(...tileMarks(l));
  return items;
}

/** Marker art (unit square, y down) placed at `center`, rotated clockwise on the page. */
export function markerItems(
  art: MarkerArt,
  center: [number, number],
  widthMm: number,
  rotationDeg: number,
  role: string,
): DrawItem[] {
  const a = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const map = ([u, v]: [number, number]): [number, number] => {
    const x = (u - 0.5) * widthMm;
    const y = (v - 0.5) * widthMm;
    return [center[0] + x * c - y * s, center[1] + x * s + y * c];
  };
  return art.shapes.map((sh) => ({
    kind: 'shape' as const,
    role,
    rings: sh.rings.map((r) => r.map(map)),
    closed: true,
    fill: sh.fill === 0 ? BLACK : WHITE,
  }));
}

function text(
  x: number,
  y: number,
  s: string,
  sizeMm: number,
  anchor: 'start' | 'middle' | 'end',
  role: string,
): Extract<DrawItem, { kind: 'text' }> {
  return { kind: 'text', x, y, text: s, sizeMm, anchor, fill: BLACK, role };
}

/** "FRONT" label with a triangle pointing to the front (page bottom) edge. */
function frontArrow(cx: number, top: number): DrawItem[] {
  return [
    { ...text(cx, top + 5, 'FRONT', 5, 'middle', 'front'), bold: true },
    {
      kind: 'shape',
      role: 'front',
      rings: [
        [
          [cx - 7, top + 8],
          [cx + 7, top + 8],
          [cx, top + 17],
        ],
      ],
      closed: true,
      fill: BLACK,
    },
  ];
}

/** 100 mm calibration ruler with alternating 10 mm blocks. */
function ruler(x: number, y: number): DrawItem[] {
  const items: DrawItem[] = [];
  const barY = y + 4;
  const barH = 3;
  const blocks: [number, number][][] = [];
  for (let i = 0; i < 10; i += 2) blocks.push(rectRing({ x: x + i * 10, y: barY, w: 10, h: barH }));
  items.push({ kind: 'shape', role: 'ruler', rings: blocks, closed: true, fill: BLACK });
  items.push({
    kind: 'shape',
    role: 'ruler',
    rings: [rectRing({ x, y: barY, w: 100, h: barH })],
    closed: true,
    stroke: { color: BLACK, widthMm: 0.2 },
  });
  const ticks: [number, number][][] = [];
  for (let mm = 0; mm <= 100; mm += 5) {
    const len = mm % 10 === 0 ? 1.5 : 0.8;
    ticks.push([
      [x + mm, barY - len],
      [x + mm, barY],
    ]);
  }
  items.push({
    kind: 'shape',
    role: 'ruler',
    rings: ticks,
    closed: false,
    stroke: { color: BLACK, widthMm: 0.2 },
  });
  items.push(text(x, y + 2, '0', 2.2, 'start', 'ruler'));
  items.push(text(x + 50, y + 2, '50', 2.2, 'middle', 'ruler'));
  items.push(text(x + 100, y + 2, '100 mm', 2.2, 'end', 'ruler'));
  items.push(
    text(
      x + 50,
      y + 12,
      'Print at 100% / Actual size. This bar must measure 100 mm.',
      2.4,
      'middle',
      'ruler',
    ),
  );
  return items;
}

/** Crosshairs in the overlap zones and a label per sheet, for assembling tiled mats. */
function tileMarks(l: MatLayout): DrawItem[] {
  const plan = l.tilePlan!;
  // never draw over markers (it would change the tracked image) or other elements
  const obstacles: Rect[] = [
    ...l.markers.map((m) => {
      const s = m.widthMm + 2 * MARKER_QUIET_MM;
      return { x: m.center[0] - s / 2, y: m.center[1] - s / 2, w: s, h: s };
    }),
    l.qr,
    l.ruler,
    l.front,
    ...(l.title ? [l.title.rect] : []),
  ];
  const clear = (r: Rect) =>
    !obstacles.some(
      (o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h,
    );

  const lines: [number, number][][] = [];
  const addCross = (x: number, y: number) => {
    if (!clear({ x: x - 4, y: y - 4, w: 8, h: 8 })) return;
    lines.push(
      [
        [x - 4, y],
        [x + 4, y],
      ],
      [
        [x, y - 4],
        [x, y + 4],
      ],
    );
  };
  const o = TILE_OVERLAP_MM / 2;
  const [W, H] = l.sizeMm;
  for (const win of plan.windows) {
    // the last row/column of sheets may extend past the mat: only mark the mat itself
    const w = Math.min(win.x + win.w, W) - win.x;
    const h = Math.min(win.y + win.h, H) - win.y;
    // centre line of each overlap strip, along the shared edge
    if (win.col > 0) {
      for (const f of [0.1, 0.5, 0.9]) addCross(win.x + o, win.y + h * f);
    }
    if (win.row > 0) {
      for (const f of [0.1, 0.5, 0.9]) addCross(win.x + w * f, win.y + o);
    }
  }
  const items: DrawItem[] = [];
  if (lines.length) {
    items.push({
      kind: 'shape',
      role: 'align',
      rings: lines,
      closed: false,
      stroke: { color: GRAY, widthMm: 0.3 },
    });
  }
  for (const win of plan.windows) {
    const label = tileLabel(win.col, win.row);
    const inset = TILE_OVERLAP_MM + 2;
    const w = Math.min(win.x + win.w, W) - win.x;
    const h = Math.min(win.y + win.h, H) - win.y;
    const spots: [number, number][] = [
      [win.x + inset, win.y + inset],
      [win.x + w - inset - 12, win.y + inset],
      [win.x + inset, win.y + h - inset - 6],
      [win.x + w - inset - 12, win.y + h - inset - 6],
      [win.x + w / 2 - 6, win.y + h / 2 - 3],
    ];
    const spot = spots.find(([x, y]) => clear({ x, y, w: 12, h: 6 }));
    if (spot) {
      items.push({
        ...text(spot[0], spot[1] + 5, label, 4, 'start', 'tile-label'),
        fill: GRAY,
      });
    }
  }
  return items;
}
