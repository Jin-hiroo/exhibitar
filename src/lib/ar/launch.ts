/**
 * Heavy viewer runtime, loaded with a dynamic import() so the landing card
 * stays light (ARCHITECTURE.md §9: interactive in < 3 s on 4G).
 */
import type { ViewerProject } from '../types';
import { loadExhibitAssets, type ExhibitAssets } from './assets';
import { ExhibitScene } from './exhibit-scene';

export { ArRuntime, type ArStatus } from './ar-runtime';
export type { ExhibitScene as ExhibitSceneType } from './exhibit-scene';
export { OrbitViewer } from './orbit-viewer';
export { ExhibitScene };

export interface PreparedExhibit {
  assets: ExhibitAssets;
  /** build a fresh scene graph for a viewing mode */
  createScene(): ExhibitScene;
}

export async function prepareExhibit(
  project: ViewerProject,
  base: string,
): Promise<PreparedExhibit> {
  const assets = await loadExhibitAssets(project, base);
  return {
    assets,
    createScene: () => new ExhibitScene(project, assets.geometry.clone()),
  };
}
