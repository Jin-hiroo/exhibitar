import { pickTagIds } from 'matar';
import type { Polygons } from '../geometry/polygons';
import type { MatTag, Project } from '../types';
import { buildMatDrawing } from './drawing';
import { printInstructions } from './instructions';
import { layoutMat, MAX_TAGS, TAG_FAMILY, type MatLayout } from './layout';
import { PRINTER_MARGIN_MM, tileLabel, type PaperPreference } from './paper';
import { renderPdf, type PdfPage } from './pdf';
import { qrPng, viewerUrl } from './qr';
import { MAT_DESIGN_VERSION } from './rebuild';
import { renderSvg } from './svg';

export interface MatInput {
  projectId: string;
  /** part of the tag-ID seed, so a new geometry version gets new tags */
  geometryVersion: number;
  title: string;
  /** canonical public origin (NEXT_PUBLIC_SITE_URL), never a preview URL */
  siteUrl: string;
  /** mat XZ, mm (from the geometry footprint) */
  contactOutlineMm: Polygons;
  shadowOutlineMm: Polygons;
  contactWeak: boolean;
  paperPreference?: PaperPreference;
}

export interface GeneratedMat {
  /** everything for `Project.mat` except the SVG's storage path */
  meta: Omit<Project['mat'], 'svgPath' | 'markers' | 'trackImage' | 'tags' | 'tagFamily'> & {
    tags: MatTag[];
    tagFamily: string;
  };
  /** the full mat at actual size */
  svg: string;
  /** one SVG per sheet when tiled (empty for single-sheet mats) */
  tileSvgs: { label: string; svg: string }[];
  /** actual size, one page per sheet */
  pdf: Uint8Array;
  qrUrl: string;
  qrPng: Uint8Array;
  instructions: string;
  layout: MatLayout;
}

/**
 * Stable per project + geometry version: exhibits in one room get different
 * tags, and a rebuilt mat gets new ones, so an old print can't be mistaken for it.
 */
export function tagSeedFor(projectId: string, geometryVersion: number): string {
  return `${projectId}:${geometryVersion}`;
}

export function generateMat(input: MatInput): GeneratedMat {
  const layout = layoutMat({
    shadowOutlineMm: input.shadowOutlineMm,
    title: input.title,
    // more than the rings take: the layout tells a too-big inner ring by its count
    tagIds: pickTagIds(
      TAG_FAMILY,
      2 * MAX_TAGS,
      tagSeedFor(input.projectId, input.geometryVersion),
    ),
    paperPreference: input.paperPreference,
  });
  const qrUrl = viewerUrl(input.siteUrl, input.projectId);
  const items = buildMatDrawing({
    layout,
    contactOutlineMm: input.contactOutlineMm,
    shadowOutlineMm: input.shadowOutlineMm,
    contactWeak: input.contactWeak,
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

  // already in mat XZ (matar's board frame)
  const tags: MatTag[] = layout.tags.map((t) => ({
    id: t.id,
    centerMm: [t.centerMm[0], t.centerMm[1]],
    sizeMm: t.sizeMm,
    rotationDeg: t.rotationDeg,
  }));

  return {
    meta: {
      paper: layout.paper,
      orientation: layout.orientation,
      tiles: layout.tiles,
      sizeMm: layout.sizeMm,
      contactOutlineMm: input.contactOutlineMm,
      shadowOutlineMm: input.shadowOutlineMm,
      tagFamily: TAG_FAMILY,
      tags,
      qrUrl,
      designVersion: MAT_DESIGN_VERSION,
    },
    svg,
    tileSvgs,
    pdf: renderPdf(items, pages),
    qrUrl,
    qrPng: qrPng(qrUrl),
    instructions: printInstructions(layout, input.title),
    layout,
  };
}
