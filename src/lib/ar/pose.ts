import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Marker, Project } from '../types';
import { mmToM } from '../units';

/**
 * Pose math for the AR viewer (docs/ARCHITECTURE.md §2, §5). Metres, mat frame
 * = world of the exhibit:
 *
 *   worldFromMat   = fused over tracked markers (rigid fit on centres, or
 *                    worldFromImage ∘ inverse(matFromImage) averaged)
 *   worldFromModel = worldFromMat ∘ calibration ∘ objectToMat
 */

// ---------------------------------------------------------------------------
// Marker poses in the mat frame

/**
 * How a tracker orients an image's XRSpace. Internally we use a
 * "page-aligned" image frame: +X toward the image's right edge, +Y out of the
 * paper (normal), +Z toward the image's bottom edge — i.e. aligned with the
 * mat frame for an unrotated marker.
 *
 * - 'spec':   W3C WebXR Image Tracking — +X right, +Y toward the image top,
 *             +Z normal toward the viewer.
 * - 'arcore': ARCore Augmented Images — +X right, +Y normal, +Z toward the
 *             image bottom.
 *
 * Which one Chrome reports is Task D0; `detectImageConvention` measures it on
 * the device whenever ≥ 3 markers are tracked.
 */
export type ImageConvention = 'spec' | 'arcore';
export const IMAGE_CONVENTIONS: ImageConvention[] = ['spec', 'arcore'];
export const DEFAULT_IMAGE_CONVENTION: ImageConvention = 'spec';

/** page-aligned image frame ← tracker's image frame */
export function imageFromTracker(convention: ImageConvention): Matrix4 {
  // spec: tracker X = X, tracker Y (top) = −Z, tracker Z (normal) = +Y  → Rx(−90°)
  return convention === 'spec' ? new Matrix4().makeRotationX(-Math.PI / 2) : new Matrix4();
}

/**
 * Pose of a marker's tracker image frame in the mat frame (metres).
 * Page x → mat +X, page y (down) → mat +Z, paper normal → mat +Y; a marker
 * rotated θ clockwise on the page is rotated −θ about +Y.
 */
export function matFromImage(
  marker: Pick<Marker, 'centerMm' | 'rotationDeg'>,
  convention: ImageConvention = DEFAULT_IMAGE_CONVENTION,
): Matrix4 {
  const t = new Matrix4().makeTranslation(mmToM(marker.centerMm[0]), 0, mmToM(marker.centerMm[1]));
  const r = new Matrix4().makeRotationY((-marker.rotationDeg * Math.PI) / 180);
  return t.multiply(r).multiply(imageFromTracker(convention));
}

// ---------------------------------------------------------------------------
// Multi-marker fusion

export interface MarkerObservation {
  markerId: string;
  /** XRPose.transform.matrix of the tracked image, as a Matrix4 */
  worldFromImage: Matrix4;
  /** XRImageTrackingResult.trackingState */
  state: 'tracked' | 'emulated';
  /** extra confidence in 0..1 (e.g. from image size on screen); default 1 */
  weight?: number;
}

export interface FusedPose {
  worldFromMat: Matrix4;
  used: string[];
  rejected: string[];
  /** 'fit': rigid fit on ≥ 3 marker centres (convention-independent); 'average': per-marker poses */
  method: 'fit' | 'average';
  /** RMS distance between fitted and observed marker centres, metres ('fit' only) */
  residualM?: number;
}

/** Weight of an 'emulated' (not currently seen, extrapolated) image vs a 'tracked' one. */
export const EMULATED_WEIGHT = 0.2;
/** A marker centre further than this from the rigid fit is an outlier. */
export const OUTLIER_DISTANCE_M = 0.02;

type Pickable = Pick<Marker, 'id' | 'centerMm' | 'rotationDeg'>;

/**
 * Estimate the mat's pose in the world from every tracked marker.
 * With ≥ 3 markers the pose comes from the marker *centres* alone (a rigid
 * fit over the wide corner baseline): steadier than any single image's
 * orientation and independent of the tracker's axis convention. Outliers are
 * dropped one at a time while ≥ 3 remain. With 1–2 markers the per-marker
 * poses are averaged, which needs the right `convention`.
 */
export function estimateWorldFromMat(
  observations: MarkerObservation[],
  markers: Pickable[],
  convention: ImageConvention = DEFAULT_IMAGE_CONVENTION,
): FusedPose | null {
  const byId = new Map(markers.map((m) => [m.id, m]));
  let cands = observations.flatMap((o) => {
    const m = byId.get(o.markerId);
    if (!m) return [];
    const matFromImg = matFromImage(m, convention);
    return [
      {
        id: o.markerId,
        obs: o,
        matFromImg,
        weight: (o.state === 'tracked' ? 1 : EMULATED_WEIGHT) * (o.weight ?? 1),
        matPoint: new Vector3().setFromMatrixPosition(matFromImg),
        worldPoint: new Vector3().setFromMatrixPosition(o.worldFromImage),
      },
    ];
  });
  if (cands.length === 0) return null;

  const rejected: string[] = [];
  if (cands.length >= 3) {
    for (;;) {
      const { rotation, translation } = rigidFit(
        cands.map((c) => c.matPoint),
        cands.map((c) => c.worldPoint),
        cands.map((c) => c.weight),
      );
      const residuals = cands.map((c) =>
        c.matPoint.clone().applyQuaternion(rotation).add(translation).distanceTo(c.worldPoint),
      );
      const worst = residuals.indexOf(Math.max(...residuals));
      if (residuals[worst]! > OUTLIER_DISTANCE_M && cands.length > 3) {
        rejected.push(cands[worst]!.id);
        cands = cands.filter((_, i) => i !== worst);
        continue;
      }
      const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
      return {
        worldFromMat: new Matrix4().compose(translation, rotation, new Vector3(1, 1, 1)),
        used: cands.map((c) => c.id),
        rejected,
        method: 'fit',
        residualM: rms,
      };
    }
  }

  // 1–2 markers: average the per-marker estimates of worldFromMat
  const poses = cands.map((c) =>
    decompose(c.obs.worldFromImage.clone().multiply(c.matFromImg.clone().invert())),
  );
  const rotation = averageQuaternions(
    poses.map((p) => p.quaternion),
    cands.map((c) => c.weight),
  );
  const translation = new Vector3();
  let wsum = 0;
  poses.forEach((p, i) => {
    translation.addScaledVector(p.position, cands[i]!.weight);
    wsum += cands[i]!.weight;
  });
  translation.divideScalar(wsum);
  return {
    worldFromMat: new Matrix4().compose(translation, rotation, new Vector3(1, 1, 1)),
    used: cands.map((c) => c.id),
    rejected,
    method: 'average',
  };
}

export interface ConventionScore {
  convention: ImageConvention;
  /** mean angle between observed and predicted marker orientations, degrees */
  meanErrorDeg: number;
}

/**
 * Which axis convention does the tracker use? Given a pose fitted from marker
 * centres (convention-independent), compare each tracked marker's reported
 * orientation with what each convention predicts. Best first.
 */
export function detectImageConvention(
  observations: MarkerObservation[],
  markers: Pickable[],
  worldFromMat: Matrix4,
): ConventionScore[] {
  const byId = new Map(markers.map((m) => [m.id, m]));
  const matFromWorld = worldFromMat.clone().invert();
  const tracked = observations.filter((o) => o.state === 'tracked' && byId.has(o.markerId));
  if (tracked.length === 0) return [];
  return IMAGE_CONVENTIONS.map((convention) => {
    let sum = 0;
    for (const o of tracked) {
      const observed = decompose(matFromWorld.clone().multiply(o.worldFromImage)).quaternion;
      const predicted = decompose(matFromImage(byId.get(o.markerId)!, convention)).quaternion;
      sum += (observed.angleTo(predicted) * 180) / Math.PI;
    }
    return { convention, meanErrorDeg: sum / tracked.length };
  }).sort((a, b) => a.meanErrorDeg - b.meanErrorDeg);
}

// ---------------------------------------------------------------------------
// Smoothing

export interface PoseFilterOptions {
  /** normal smoothing time constant, s */
  timeConstantS?: number;
  /** jumps bigger than this re-snap with the fast time constant */
  snapDistanceM?: number;
  snapAngleDeg?: number;
  snapTimeConstantS?: number;
}

/**
 * Exponential low-pass on position (lerp) and rotation (slerp), frame-rate
 * independent. Large jumps (e.g. tracking recovered after drift) converge
 * quickly but still smoothly. When no marker is visible, keep the last pose;
 * WebXR world tracking keeps it anchored.
 */
export class PoseFilter {
  private pos: Vector3 | null = null;
  private rot = new Quaternion();
  private readonly o: Required<PoseFilterOptions>;

  constructor(opts: PoseFilterOptions = {}) {
    this.o = {
      timeConstantS: 0.15,
      snapDistanceM: 0.05,
      snapAngleDeg: 10,
      snapTimeConstantS: 0.04,
      ...opts,
    };
  }

  update(target: Matrix4, dtS: number): Matrix4 {
    const { position, quaternion } = decompose(target);
    if (!this.pos) {
      this.pos = position;
      this.rot.copy(quaternion);
      return this.current!;
    }
    const jump =
      this.pos.distanceTo(position) > this.o.snapDistanceM ||
      (this.rot.angleTo(quaternion) * 180) / Math.PI > this.o.snapAngleDeg;
    const tau = jump ? this.o.snapTimeConstantS : this.o.timeConstantS;
    const a = 1 - Math.exp(-Math.max(0, dtS) / tau);
    this.pos.lerp(position, a);
    this.rot.slerp(quaternion, a);
    return this.current!;
  }

  /** Last filtered pose (null before the first marker was ever seen). */
  get current(): Matrix4 | null {
    return this.pos ? new Matrix4().compose(this.pos, this.rot, new Vector3(1, 1, 1)) : null;
  }

  reset(): void {
    this.pos = null;
  }
}

// ---------------------------------------------------------------------------
// Model placement

/**
 * `calibration` as a matrix in the mat frame (metres): translate by the
 * nudge and yaw about the mat origin (+yaw = counter-clockwise seen from above).
 */
export function calibrationMatrix(c: Project['calibration']): Matrix4 {
  const t = new Matrix4().makeTranslation(mmToM(c.dxMm), mmToM(c.dyMm), mmToM(c.dzMm));
  return t.multiply(new Matrix4().makeRotationY((c.yawDeg * Math.PI) / 180));
}

/** matFromModel = calibration ∘ objectToMat (what the Studio preview uses). */
export function matFromModel(calibration: Project['calibration'], objectToMat: number[]): Matrix4 {
  return calibrationMatrix(calibration).multiply(new Matrix4().fromArray(objectToMat));
}

/** worldFromModel = worldFromMat ∘ calibration ∘ objectToMat */
export function composeWorldFromModel(
  worldFromMat: Matrix4,
  calibration: Project['calibration'],
  objectToMat: number[],
): Matrix4 {
  return worldFromMat.clone().multiply(matFromModel(calibration, objectToMat));
}

// ---------------------------------------------------------------------------
// helpers

function decompose(m: Matrix4): { position: Vector3; quaternion: Quaternion } {
  const position = new Vector3();
  const quaternion = new Quaternion();
  m.decompose(position, quaternion, new Vector3());
  return { position, quaternion };
}

/** Weighted quaternion mean (sign-aligned, normalised); fine for nearby rotations. */
export function averageQuaternions(qs: Quaternion[], weights: number[]): Quaternion {
  const ref = qs[0]!;
  let x = 0;
  let y = 0;
  let z = 0;
  let w = 0;
  qs.forEach((q, i) => {
    const s = (ref.dot(q) < 0 ? -1 : 1) * weights[i]!;
    x += q.x * s;
    y += q.y * s;
    z += q.z * s;
    w += q.w * s;
  });
  return new Quaternion(x, y, z, w).normalize();
}

/**
 * Weighted rigid transform (rotation + translation) mapping points `a` onto
 * `b` in the least-squares sense (Horn's quaternion method). Works for
 * coplanar points as long as they are not collinear.
 */
export function rigidFit(
  a: Vector3[],
  b: Vector3[],
  weights: number[],
): { rotation: Quaternion; translation: Vector3 } {
  const wsum = weights.reduce((s, w) => s + w, 0);
  const ca = new Vector3();
  const cb = new Vector3();
  a.forEach((p, i) => ca.addScaledVector(p, weights[i]! / wsum));
  b.forEach((p, i) => cb.addScaledVector(p, weights[i]! / wsum));
  // cross-covariance S = Σ w (a−ca)(b−cb)ᵀ
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  a.forEach((p, i) => {
    const pa = [p.x - ca.x, p.y - ca.y, p.z - ca.z];
    const q = b[i]!;
    const pb = [q.x - cb.x, q.y - cb.y, q.z - cb.z];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) S[r * 3 + c]! += weights[i]! * pa[r]! * pb[c]!;
  });
  const [Sxx, Sxy, Sxz, Syx, Syy, Syz, Szx, Szy, Szz] = S as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  // Horn's symmetric 4×4 matrix; its top eigenvector is the rotation quaternion (w, x, y, z)
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [qw, qx, qy, qz] = topEigenvector(N);
  const rotation = new Quaternion(qx, qy, qz, qw).normalize();
  const translation = cb.clone().sub(ca.clone().applyQuaternion(rotation));
  return { rotation, translation };
}

/** Eigenvector of the largest eigenvalue of a symmetric 4×4 matrix (Jacobi rotations). */
function topEigenvector(m: number[][]): [number, number, number, number] {
  const a = m.map((r) => [...r]);
  const v = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p]![q]! ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) {
        const apq = a[p]![q]!;
        if (Math.abs(apq) < 1e-30) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 4; k++) {
          const akp = a[k]![p]!;
          const akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p]![k]!;
          const aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = v[k]![p]!;
          const vkq = v[k]![q]!;
          v[k]![p] = c * vkp - s * vkq;
          v[k]![q] = s * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i]![i]! > a[best]![best]!) best = i;
  return [v[0]![best]!, v[1]![best]!, v[2]![best]!, v[3]![best]!];
}
