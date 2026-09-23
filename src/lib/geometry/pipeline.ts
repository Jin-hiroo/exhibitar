import { computeFootprint, type Footprint } from './footprint';
import { freezeModel, DEFAULT_TARGET_TRIANGLES } from './glb';
import { computeBounds, type Bounds, type IndexedMesh } from './mesh';
import {
  applyOrientation,
  findRestingCandidates,
  type QuatTuple,
  type RestingCandidate,
} from './orient';
import { parseStl, type StlStats } from './parse-stl';
import { applySourceScale } from './scale';
import { simplifyMesh } from './simplify';

export type PipelineStage = 'parse' | 'scale' | 'orient' | 'simplify' | 'footprint';
export type ProgressFn = (stage: PipelineStage, fraction: number) => void;

export interface LoadedModel {
  /** STL × sourceScale, millimetres, raw STL axes (model coords in mm) */
  meshMm: IndexedMesh;
  sourceScale: number;
  stats: StlStats;
  warnings: string[];
  /** bounds before orientation */
  boundsMm: Bounds;
  /** best first */
  candidates: RestingCandidate[];
  /** ≤ 60k-triangle copy of `meshMm` for interactive previews */
  previewMm: IndexedMesh;
}

const PREVIEW_TRIANGLES = 60_000;

/** Studio step 1–3: parse, scale, suggest resting faces. */
export async function loadModel(
  stl: ArrayBuffer,
  sourceScale: number,
  onProgress: ProgressFn = () => {},
): Promise<LoadedModel> {
  onProgress('parse', 0);
  const { mesh, stats, warnings } = parseStl(stl);
  onProgress('scale', 0.3);
  const meshMm = applySourceScale(mesh, sourceScale);
  onProgress('orient', 0.5);
  const candidates = findRestingCandidates(meshMm);
  onProgress('orient', 0.8);
  const { mesh: previewMm } = await simplifyMesh(meshMm, PREVIEW_TRIANGLES);
  onProgress('orient', 1);
  return {
    meshMm,
    sourceScale,
    stats,
    warnings,
    boundsMm: computeBounds(meshMm.positions),
    candidates,
    previewMm,
  };
}

export interface PreparedModel {
  /** model (m) → mat (m), column-major: `Project.objectToMat` */
  objectToMat: number[];
  footprint: Footprint;
  /** the file to upload (simplified, lossless meshopt, metres) */
  glb: Uint8Array;
  /** decoded from `glb`: the mesh the editor must use (metres, model coords) */
  frozenMesh: IndexedMesh;
  triangleCount: number;
  simplifyErrorMm: number;
  /** size as it stands on the mat, mm */
  boundsMm: Bounds;
}

/** Studio step 3–4: apply the chosen orientation, freeze the GLB, compute outlines. */
export async function prepareModel(
  meshMm: IndexedMesh,
  rotation: QuatTuple,
  { targetTriangles = DEFAULT_TARGET_TRIANGLES }: { targetTriangles?: number } = {},
  onProgress: ProgressFn = () => {},
): Promise<PreparedModel> {
  onProgress('orient', 0);
  const { objectToMat, oriented } = applyOrientation(meshMm, rotation);
  onProgress('simplify', 0.2);
  const frozen = await freezeModel(meshMm, { targetTriangles });
  onProgress('footprint', 0.7);
  const footprint = await computeFootprint(oriented);
  onProgress('footprint', 1);
  return {
    objectToMat,
    footprint,
    glb: frozen.glb,
    frozenMesh: frozen.mesh,
    triangleCount: frozen.triangleCount,
    simplifyErrorMm: frozen.errorMm,
    boundsMm: computeBounds(oriented.positions),
  };
}
