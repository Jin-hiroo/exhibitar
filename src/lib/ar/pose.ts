import { Matrix4 } from 'three';
import type { Project } from '../types';
import { mmToM } from '../units';

/**
 * Model placement in the mat frame (docs/ARCHITECTURE.md §2), metres. The mat
 * frame is the world: matar tracks the printed tags in it and moves the
 * camera, so the exhibit only needs
 *
 *   matFromModel = calibration ∘ objectToMat
 */

/**
 * `calibration` as a matrix in the mat frame (metres): translate by the
 * nudge and yaw about the mat origin (+yaw = counter-clockwise seen from above).
 */
export function calibrationMatrix(c: Project['calibration']): Matrix4 {
  const t = new Matrix4().makeTranslation(mmToM(c.dxMm), mmToM(c.dyMm), mmToM(c.dzMm));
  return t.multiply(new Matrix4().makeRotationY((c.yawDeg * Math.PI) / 180));
}

/** matFromModel = calibration ∘ objectToMat (the viewer and the Studio preview). */
export function matFromModel(calibration: Project['calibration'], objectToMat: number[]): Matrix4 {
  return calibrationMatrix(calibration).multiply(new Matrix4().fromArray(objectToMat));
}
