import { UNIT_TO_MM, type LengthUnit } from '../units';
import { computeBounds, scalePositions, type Bounds, type IndexedMesh } from './mesh';

/**
 * Factor that turns raw STL numbers into millimetres: the unit the exhibitor
 * picked times an optional uniform scale. Stored as `Project.model.sourceScale`.
 * The physical print must use the same scale.
 */
export function sourceScaleFor(unit: LengthUnit, uniformScale = 1): number {
  if (!(uniformScale > 0) || !Number.isFinite(uniformScale)) {
    throw new Error(`uniform scale must be a positive number, got ${uniformScale}`);
  }
  return UNIT_TO_MM[unit] * uniformScale;
}

/** Raw STL mesh → millimetre mesh. */
export function applySourceScale(mesh: IndexedMesh, sourceScale: number): IndexedMesh {
  return sourceScale === 1 ? mesh : scalePositions(mesh, sourceScale);
}

export function boundsMm(mesh: IndexedMesh): Bounds {
  return computeBounds(mesh.positions);
}

/** "180 × 140 × 120 mm" (rounded sensibly for display). */
export function formatDimsMm(size: readonly [number, number, number]): string {
  const f = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  return `${size.map((v) => f(v).replace(/\.0+$|(\.\d*?)0+$/, '$1')).join(' × ')} mm`;
}
