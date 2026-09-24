import type { Polygons } from '../geometry/polygons';
import type { Marker, Project, TrackImage } from '../types';
import { buildMatDrawing } from './drawing';
import { printInstructions } from './instructions';
import { layoutMat, type MatLayout } from './layout';
import { pickMarkers } from './markers';
import { PRINTER_MARGIN_MM, tileLabel, type PaperPreference } from './paper';
import { encodePng } from './png';
import { renderPdf, type PdfPage } from './pdf';
import { qrPng, viewerUrl } from './qr';
import { rasterizeDrawing } from './raster-drawing';
import { renderSvg } from './svg';

export interface MatInput {
  projectId: string;
  /** part of the marker seed, so a new geometry version gets new markers */
  geometryVersion: number;
  title: string;
  /** canonical public origin (NEXT_PUBLIC_SITE_URL), never a preview URL */
  siteUrl: string;
  /** mat XZ, mm (from the geometry footprint) */
  contactOutlineMm: Polygons;
  shadowOutlineMm: Polygons;
  contactWeak: boolean;
  paperPreference?: PaperPreference;
  markerWidthMm?: number;
}

/** A `Marker` before its PNG has been uploaded (the publisher fills in `imagePath`). */
export type MarkerSpec = Omit<Marker, 'imagePath'>;
export type TrackImageSpec = Omit<TrackImage, 'imagePath'>;

/** Longest side of the whole-mat tracking image, px (ARCore needs ≥ 300). */
const TRACK_IMAGE_MAX_PX = 1600;
const TRACK_IMAGE_MAX_PX_PER_MM = 4;

export interface GeneratedMat {
  /** everything for `Project.mat` except storage paths */
  meta: Omit<Project['mat'], 'svgPath' | 'markers' | 'trackImage'> & {
    markers: MarkerSpec[];
    trackImage: TrackImageSpec;
  };
  /** the full mat at actual size */
  svg: string;
  /** one SVG per sheet when tiled (empty for single-sheet mats) */
  tileSvgs: { label: string; svg: string }[];
  /** actual size, one page per sheet */
  pdf: Uint8Array;
  markerPngs: { id: string; png: Uint8Array }[];
  /** the whole mat as one tracking image (see `meta.trackImage`) */
  trackPng: Uint8Array;
  qrUrl: string;
  qrPng: Uint8Array;
  instructions: string;
  layout: MatLayout;
}

/** Stable per project + geometry version: different exhibits in one room get different markers. */
export function markerSeedFor(projectId: string, geometryVersion: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${projectId}:${geometryVersion}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function generateMat(input: MatInput): GeneratedMat {
  const layout = layoutMat({
    shadowOutlineMm: input.shadowOutlineMm,
    title: input.title,
    markerWidthMm: input.markerWidthMm,
    paperPreference: input.paperPreference,
  });
  const markers = pickMarkers(
    markerSeedFor(input.projectId, input.geometryVersion),
    layout.markers.length,
  );
  const qrUrl = viewerUrl(input.siteUrl, input.projectId);
  const items = buildMatDrawing({
    layout,
    contactOutlineMm: input.contactOutlineMm,
    shadowOutlineMm: input.shadowOutlineMm,
    contactWeak: input.contactWeak,
    markerArts: markers.map((m) => m.art),
    title: input.title,
    qrText: qrUrl,
  });

  const [W, H] = layout.sizeMm;
  const svg = renderSvg(items, { x: 0, y: 0, w: W, h: H });
  const plan = layout.tilePlan;
  const pages: PdfPage[] = plan
    ? plan.windows.map((win) => ({
        sizeMm: plan.sizeMm,
        offsetMm: [win.x - PRINTER_MARGIN_MM, win.y - PRINTER_MARGIN_MM],
      }))
    : [{ sizeMm: [W, H], offsetMm: [0, 0] }];
  const tileSvgs = plan
    ? plan.windows.map((win, i) => ({
        label: tileLabel(win.col, win.row),
        svg: renderSvg(items, {
          x: pages[i]!.offsetMm[0],
          y: pages[i]!.offsetMm[1],
          w: plan.sizeMm[0],
          h: plan.sizeMm[1],
        }),
      }))
    : [];

  const markerSpecs: MarkerSpec[] = layout.markers.map((slot, i) => ({
    id: `m${i}`,
    widthMm: slot.widthMm,
    // page → mat XZ
    centerMm: [slot.center[0] - layout.originMm[0], slot.center[1] - layout.originMm[1]],
    rotationDeg: slot.rotationDeg,
    seed: markers[i]!.art.seed,
  }));

  const pxPerMm = Math.min(TRACK_IMAGE_MAX_PX_PER_MM, TRACK_IMAGE_MAX_PX / Math.max(W, H));
  const trackPng = encodePng(rasterizeDrawing(items, { x: 0, y: 0, w: W, h: H }, pxPerMm));
  const trackImage: TrackImageSpec = {
    widthMm: W,
    heightMm: H,
    centerMm: [W / 2 - layout.originMm[0], H / 2 - layout.originMm[1]],
  };

  return {
    meta: {
      paper: layout.paper,
      orientation: layout.orientation,
      tiles: layout.tiles,
      sizeMm: layout.sizeMm,
      contactOutlineMm: input.contactOutlineMm,
      shadowOutlineMm: input.shadowOutlineMm,
      markers: markerSpecs,
      trackImage,
      qrUrl,
    },
    svg,
    tileSvgs,
    pdf: renderPdf(items, pages),
    markerPngs: markers.map((m, i) => ({ id: `m${i}`, png: m.png })),
    trackPng,
    qrUrl,
    qrPng: qrPng(qrUrl),
    instructions: printInstructions(layout, input.title),
    layout,
  };
}
