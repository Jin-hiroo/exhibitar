import { footprintStats } from '../geometry/footprint-stats';
import type { Project } from '../types';
import type { MatInput } from './generate';
import type { PaperName, PaperPreference } from './paper';

/**
 * Generation of the mat design, stored as `mat.designVersion`. Bump it when a
 * change makes existing prints track clearly worse than a rebuilt mat would:
 * the Studio then offers to rebuild older mats.
 *
 * 2 (2026-10-14): tracking texture and bigger markers. ARCore rejects the
 * whole-page image of older mats, so phones only find them from close up
 * (docs/D0-FINDINGS.md §4).
 */
export const MAT_DESIGN_VERSION = 2;

/** True when a stored mat was made with an older design than the current one. */
export function matDesignOutdated(mat: Pick<Project['mat'], 'designVersion'>): boolean {
  return (mat.designVersion ?? 1) < MAT_DESIGN_VERSION;
}

const PAPER_FAMILY: Record<PaperName, PaperPreference> = {
  A4: 'iso',
  A3: 'iso',
  Letter: 'us',
  Tabloid: 'us',
};

/**
 * Inputs to regenerate a saved mat without the STL (it never leaves the
 * exhibitor's browser): the stored outlines and paper family, plus the current
 * title and site URL. The result is a new geometry version (new markers, new
 * file names past the CDN cache) that keeps the stored GLB, so painted
 * regions stay valid.
 */
export function rebuildMatInput(
  project: Pick<Project, 'id' | 'title' | 'geometryVersion' | 'mat'>,
  siteUrl: string,
): MatInput {
  const { contactOutlineMm, shadowOutlineMm, paper } = project.mat;
  return {
    projectId: project.id,
    geometryVersion: project.geometryVersion + 1,
    title: project.title || 'Exhibit',
    siteUrl,
    contactOutlineMm,
    shadowOutlineMm,
    contactWeak: footprintStats(contactOutlineMm, shadowOutlineMm).contactWeak,
    paperPreference: PAPER_FAMILY[paper],
  };
}
