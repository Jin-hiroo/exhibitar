import * as poly from './polygons';
import type { Polygons } from './polygons';

export interface FootprintStats {
  contactAreaMm2: number;
  shadowAreaMm2: number;
  contactIslands: number;
  /** contact is tiny or fragmented: the mat should emphasise the shadow outline */
  contactWeak: boolean;
}

/**
 * Statistics of contact/shadow outlines (mat XZ, mm). Depends on the outlines
 * only, so a stored mat can be rebuilt without the mesh.
 */
export function footprintStats(contact: Polygons, shadow: Polygons): FootprintStats {
  const contactAreaMm2 = poly.area(contact);
  const shadowAreaMm2 = poly.area(shadow);
  const contactIslands = poly.outerRingCount(contact);
  return {
    contactAreaMm2,
    shadowAreaMm2,
    contactIslands,
    contactWeak:
      contactAreaMm2 < 25 || contactAreaMm2 < 0.05 * shadowAreaMm2 || contactIslands > 12,
  };
}
