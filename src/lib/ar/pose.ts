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
// Multi-image fusion

/**
 * Anything the tracker is given as a reference image: the corner markers and,
 * optionally, the whole printed mat. Poses are in the mat frame (mm, page-aligned
 * image rotated `rotationDeg` clockwise on the page).
 */
export interface TrackTarget {
  id: string;
  centerMm: [number, number];
  rotationDeg: number;
  widthMm: number;
  /** defaults to `widthMm` (square markers) */
  heightMm?: number;
}

/** Id of the whole-mat tracking image. */
export const MAT_TARGET_ID = 'mat';

/**
 * Tracking targets in `trackedImages` order: the markers, then (if present
 * and enabled) the whole-mat image.
 */
export function trackTargets(
  mat: Pick<Project['mat'], 'markers' | 'trackImage'>,
  { includeMatImage = true }: { includeMatImage?: boolean } = {},
): TrackTarget[] {
  const targets: TrackTarget[] = (mat.markers ?? []).map((m) => ({
    id: m.id,
    centerMm: m.centerMm,
    rotationDeg: m.rotationDeg,
    widthMm: m.widthMm,
  }));
  if (includeMatImage && mat.trackImage) {
    targets.push({
      id: MAT_TARGET_ID,
      centerMm: mat.trackImage.centerMm,
      rotationDeg: 0,
      widthMm: mat.trackImage.widthMm,
      heightMm: mat.trackImage.heightMm,
    });
  }
  return targets;
}

export interface MarkerObservation {
  /** a TrackTarget id */
  markerId: string;
  /** XRPose.transform.matrix of the tracked image, as a Matrix4 */
  worldFromImage: Matrix4;
  /** XRImageTrackingResult.trackingState */
  state: 'tracked' | 'emulated';
  /** extra confidence in 0..1; default 1 */
  weight?: number;
  /** XRImageTrackingResult.measuredWidthInMeters (0 / undefined if unknown) */
  measuredWidthM?: number;
}

export interface FusedPose {
  worldFromMat: Matrix4;
  used: string[];
  rejected: string[];
  /** the tracker axis convention that fitted best this frame */
  convention: ImageConvention;
  /**
   * Why that convention: it explained more images ('inliers'), fitted clearly
   * better ('residual'), put the mat flat on a table ('gravity'), or the frame
   * could not tell ('preferred', e.g. one image seen head-on).
   */
  decidedBy: 'inliers' | 'residual' | 'gravity' | 'preferred';
  /** RMS distance between fitted and observed image corners/centres, metres */
  residualM: number;
  /** residual of each convention (the loser is typically centimetres off) */
  residualByConvention: Record<ImageConvention, number>;
  inliersByConvention: Record<ImageConvention, number>;
}

/** Weight of an 'emulated' (not currently seen, extrapolated) image vs a 'tracked' one. */
export const EMULATED_WEIGHT = 0.2;
/** A target whose points sit further than this from the fit is an outlier. */
export const OUTLIER_DISTANCE_M = 0.02;
/** Keep the preferred convention unless the other fits this much better. */
const CONVENTION_SWITCH_RATIO = 0.5;
/** Residual differences below this are tracker noise, not evidence. */
const RESIDUAL_NOISE_M = 0.001;
/** Gravity tie-break: the mats lie on tables, and WebXR's reference spaces are Y-up. */
const WORLD_UP = new Vector3(0, 1, 0);
const GRAVITY_MARGIN = 0.3;

/**
 * Estimate the mat's pose in the world from every tracked image.
 *
 * Each image contributes 5 point correspondences — its centre and 4 corners —
 * between the mat frame (known exactly from the layout) and the world (its
 * tracked pose). One rigid fit over all points uses both the orientation of
 * each image and the wide baseline between images, and works from a single
 * image upwards. The fit is run for both tracker axis conventions; a wrong
 * convention puts the corners out of the paper plane, so its residual is
 * obviously larger. Outlier images are dropped while more than one remains.
 */
export function estimateWorldFromMat(
  observations: MarkerObservation[],
  targets: TrackTarget[],
  preferred: ImageConvention = DEFAULT_IMAGE_CONVENTION,
): FusedPose | null {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const obs = observations.filter((o) => byId.has(o.markerId));
  if (obs.length === 0) return null;

  const fits = IMAGE_CONVENTIONS.map((c) => fitConvention(obs, byId, c));
  const byConv = Object.fromEntries(fits.map((f) => [f.convention, f])) as Record<
    ImageConvention,
    (typeof fits)[number]
  >;
  const other: ImageConvention = preferred === 'spec' ? 'arcore' : 'spec';
  const [p, o] = [byConv[preferred], byConv[other]];
  let chosen = p;
  let decidedBy: FusedPose['decidedBy'] = 'preferred';
  if (p.used.length !== o.used.length) {
    // A wrong convention can only "fit" by rejecting images as outliers.
    chosen = p.used.length > o.used.length ? p : o;
    decidedBy = 'inliers';
  } else if (clearlyBetter(o.residualM, p.residualM)) {
    chosen = o;
    decidedBy = 'residual';
  } else if (clearlyBetter(p.residualM, o.residualM)) {
    decidedBy = 'residual';
  } else {
    // Ambiguous (e.g. a single image): the two candidates differ by a 90° tilt.
    const up = (f: typeof p) =>
      new Vector3(0, 1, 0).transformDirection(f.worldFromMat).dot(WORLD_UP);
    if (up(o) > up(p) + GRAVITY_MARGIN) {
      chosen = o;
      decidedBy = 'gravity';
    } else if (up(p) > up(o) + GRAVITY_MARGIN) {
      decidedBy = 'gravity';
    }
  }
  return {
    worldFromMat: chosen.worldFromMat,
    used: chosen.used,
    rejected: chosen.rejected,
    convention: chosen.convention,
    decidedBy,
    residualM: chosen.residualM,
    residualByConvention: { spec: byConv.spec.residualM, arcore: byConv.arcore.residualM },
    inliersByConvention: { spec: byConv.spec.used.length, arcore: byConv.arcore.used.length },
  };
}

/** Residual `a` beats `b` by a clear ratio *and* by more than tracker noise. */
function clearlyBetter(a: number, b: number): boolean {
  return a < b * CONVENTION_SWITCH_RATIO && b - a > RESIDUAL_NOISE_M;
}

function fitConvention(
  observations: MarkerObservation[],
  targets: Map<string, TrackTarget>,
  convention: ImageConvention,
): Omit<FusedPose, 'residualByConvention' | 'inliersByConvention' | 'decidedBy'> {
  let cands = observations.map((o) => {
    const t = targets.get(o.markerId)!;
    const local = targetPoints(t, convention);
    const matFromImg = matFromImage(t, convention);
    return {
      id: o.markerId,
      weight: (o.state === 'tracked' ? 1 : EMULATED_WEIGHT) * (o.weight ?? 1),
      matPts: local.map((p) => p.clone().applyMatrix4(matFromImg)),
      worldPts: local.map((p) => p.clone().applyMatrix4(o.worldFromImage)),
    };
  });
  const rejected: string[] = [];
  for (;;) {
    const a = cands.flatMap((c) => c.matPts);
    const b = cands.flatMap((c) => c.worldPts);
    const w = cands.flatMap((c) => c.matPts.map(() => c.weight));
    const { rotation, translation } = rigidFit(a, b, w);
    const errs = cands.map((c) =>
      c.matPts.map((p, i) =>
        p.clone().applyQuaternion(rotation).add(translation).distanceTo(c.worldPts[i]!),
      ),
    );
    const perTarget = errs.map((e) => e.reduce((s, x) => s + x, 0) / e.length);
    const worst = perTarget.indexOf(Math.max(...perTarget));
    if (perTarget[worst]! > OUTLIER_DISTANCE_M && cands.length > 1) {
      rejected.push(cands[worst]!.id);
      cands = cands.filter((_, i) => i !== worst);
      continue;
    }
    const all = errs.flat();
    return {
      worldFromMat: new Matrix4().compose(translation, rotation, new Vector3(1, 1, 1)),
      used: cands.map((c) => c.id),
      rejected,
      convention,
      residualM: Math.sqrt(all.reduce((s, x) => s + x * x, 0) / all.length),
    };
  }
}

/** Centre + 4 corners of a target, in the tracker's image frame for `convention` (metres). */
function targetPoints(t: TrackTarget, convention: ImageConvention): Vector3[] {
  const hw = mmToM(t.widthMm) / 2;
  const hh = mmToM(t.heightMm ?? t.widthMm) / 2;
  // 'spec': image plane is XY (+Y = top); 'arcore': image plane is XZ (+Z = bottom)
  const p = (x: number, v: number) =>
    convention === 'spec' ? new Vector3(x, v, 0) : new Vector3(x, 0, -v);
  return [p(0, 0), p(-hw, hh), p(hw, hh), p(hw, -hh), p(-hw, -hh)];
}

/**
 * Print-scale check: measured / expected width of each tracked image whose
 * size the tracker reported. ≈ 1 when the mat was printed at 100 %.
 */
export function printScales(
  observations: MarkerObservation[],
  targets: TrackTarget[],
): { id: string; scale: number }[] {
  const byId = new Map(targets.map((t) => [t.id, t]));
  return observations.flatMap((o) => {
    const t = byId.get(o.markerId);
    if (!t || !o.measuredWidthM || o.state !== 'tracked') return [];
    return [{ id: o.markerId, scale: o.measuredWidthM / mmToM(t.widthMm) }];
  });
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
