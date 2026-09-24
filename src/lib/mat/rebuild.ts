import { footprintStats } from '../geometry/footprint-stats';
import type { Project } from '../types';
import type { MatInput } from './generate';
import type { PaperName, PaperPreference } from './paper';

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
