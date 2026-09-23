import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { markerItems } from '../mat/drawing';
import type { MarkerArt } from '../mat/markers';
import type { Marker } from '../types';
import {
  composeWorldFromModel,
  estimateWorldFromMat,
  matFromImage,
  PoseFilter,
  rigidFit,
  type MarkerObservation,
} from './pose';

// A4-landscape-like layout: four 60 mm markers near the corners (mat XZ, mm)
const MARKERS: Marker[] = [
  [-108.5, -65],
  [108.5, -65],
  [-108.5, 65],
  [108.5, 65],
].map(([x, z], i) => ({
  id: `m${i}`,
  imagePath: '',
  widthMm: 60,
  centerMm: [x!, z!],
  rotationDeg: i === 3 ? 90 : 0,
  seed: i,
}));

/** deterministic noise */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
}

const TRUE_POSE = new Matrix4().compose(
  new Vector3(0.3, -0.8, -0.5),
  new Quaternion().setFromAxisAngle(new Vector3(0.2, 1, 0.1).normalize(), 0.7),
  new Vector3(1, 1, 1),
);

function observe(
  worldFromMat: Matrix4,
  markers: Marker[],
  noise?: { posM: number; angleDeg: number; seed: number },
): MarkerObservation[] {
  const r = rng(noise?.seed ?? 1);
  return markers.map((m) => {
    const worldFromImage = worldFromMat.clone().multiply(matFromImage(m));
    if (noise) {
      const q = new Quaternion().setFromAxisAngle(
        new Vector3(r(), r(), r()).normalize(),
        (noise.angleDeg * Math.PI) / 180,
      );
      const p = new Vector3(r(), r(), r()).multiplyScalar(noise.posM);
      const pos = new Vector3();
      const rot = new Quaternion();
      worldFromImage.decompose(pos, rot, new Vector3());
      worldFromImage.compose(pos.add(p), q.multiply(rot), new Vector3(1, 1, 1));
    }
    return { markerId: m.id, worldFromImage, state: 'tracked' as const };
  });
}

function poseError(a: Matrix4, b: Matrix4) {
  const pa = new Vector3();
  const pb = new Vector3();
  const qa = new Quaternion();
  const qb = new Quaternion();
  a.decompose(pa, qa, new Vector3());
  b.decompose(pb, qb, new Vector3());
  return { mm: pa.distanceTo(pb) * 1000, deg: (qa.angleTo(qb) * 180) / Math.PI };
}

/** Error at a point 10 cm above the mat centre: what a label on a 20 cm object feels. */
function labelErrorMm(est: Matrix4, truth: Matrix4) {
  const p = new Vector3(0, 0.1, 0);
  return p.clone().applyMatrix4(est).distanceTo(p.clone().applyMatrix4(truth)) * 1000;
}

describe('matFromImage', () => {
  it('matches how the mat SVG draws the marker (page x→X, page y→Z, clockwise rotation)', () => {
    const art: MarkerArt = {
      seed: 0,
      shapes: [
        {
          fill: 0,
          rings: [
            [
              [1, 0.5],
              [0.5, 1],
              [0.5, 0.5],
            ],
          ],
        },
      ],
    };
    for (const rotationDeg of [0, 90, 30]) {
      const m = { centerMm: [40, -25] as [number, number], rotationDeg };
      const [item] = markerItems(art, m.centerMm, 60, rotationDeg, 't');
      if (item?.kind !== 'shape') throw new Error();
      // image-frame points (metres): right edge centre (+X) and bottom edge centre (+Z)
      const right = new Vector3(0.03, 0, 0).applyMatrix4(matFromImage(m));
      const bottom = new Vector3(0, 0, 0.03).applyMatrix4(matFromImage(m));
      expect(right.x * 1000).toBeCloseTo(item.rings[0]![0]![0], 6);
      expect(right.z * 1000).toBeCloseTo(item.rings[0]![0]![1], 6);
      expect(bottom.x * 1000).toBeCloseTo(item.rings[0]![1]![0], 6);
      expect(bottom.z * 1000).toBeCloseTo(item.rings[0]![1]![1], 6);
      expect(right.y).toBeCloseTo(0, 9);
    }
  });
});

describe('estimateWorldFromMat', () => {
  it('recovers the exact pose from perfect observations (1, 2 and 4 markers)', () => {
    for (const n of [1, 2, 4]) {
      const est = estimateWorldFromMat(observe(TRUE_POSE, MARKERS.slice(0, n)), MARKERS)!;
      const e = poseError(est.worldFromMat, TRUE_POSE);
      expect(e.mm).toBeLessThan(1e-3);
      expect(e.deg).toBeLessThan(1e-3);
      expect(est.used).toHaveLength(n);
    }
  });

  it('stays within ~3 mm at label height with realistic tracker noise', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const obs = observe(TRUE_POSE, MARKERS, { posM: 0.002, angleDeg: 2, seed });
      const est = estimateWorldFromMat(obs, MARKERS)!;
      expect(labelErrorMm(est.worldFromMat, TRUE_POSE)).toBeLessThan(3);
    }
  });

  it('beats a single marker thanks to the wide baseline', () => {
    let fused = 0;
    let single = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const obs = observe(TRUE_POSE, MARKERS, { posM: 0.002, angleDeg: 2, seed });
      fused += labelErrorMm(estimateWorldFromMat(obs, MARKERS)!.worldFromMat, TRUE_POSE);
      single += labelErrorMm(
        estimateWorldFromMat(obs.slice(0, 1), MARKERS)!.worldFromMat,
        TRUE_POSE,
      );
    }
    expect(fused).toBeLessThan(single / 2);
  });

  it('rejects a marker whose estimate is way off', () => {
    const obs = observe(TRUE_POSE, MARKERS);
    obs[2]!.worldFromImage.premultiply(new Matrix4().makeTranslation(0.1, 0, 0));
    const est = estimateWorldFromMat(obs, MARKERS)!;
    expect(est.rejected).toEqual(['m2']);
    expect(poseError(est.worldFromMat, TRUE_POSE).mm).toBeLessThan(1e-3);
  });

  it('trusts tracked images more than emulated ones', () => {
    const obs = observe(TRUE_POSE, MARKERS.slice(0, 2));
    obs[1]!.state = 'emulated';
    obs[1]!.worldFromImage.premultiply(new Matrix4().makeTranslation(0.01, 0, 0));
    const est = estimateWorldFromMat(obs, MARKERS)!;
    const e = poseError(est.worldFromMat, TRUE_POSE).mm;
    expect(e).toBeGreaterThan(1);
    expect(e).toBeLessThan(2); // 10 mm × 0.2 / 1.2
  });

  it('ignores unknown markers and returns null with nothing tracked', () => {
    expect(estimateWorldFromMat([], MARKERS)).toBeNull();
    const obs = observe(TRUE_POSE, MARKERS.slice(0, 1));
    obs[0]!.markerId = 'nope';
    expect(estimateWorldFromMat(obs, MARKERS)).toBeNull();
  });
});

describe('rigidFit', () => {
  it('fits coplanar points', () => {
    const a = MARKERS.map((m) => new Vector3(m.centerMm[0] / 1000, 0, m.centerMm[1] / 1000));
    const b = a.map((p) => p.clone().applyMatrix4(TRUE_POSE));
    const { rotation, translation } = rigidFit(a, b, [1, 1, 1, 1]);
    const est = new Matrix4().compose(translation, rotation, new Vector3(1, 1, 1));
    expect(poseError(est, TRUE_POSE).mm).toBeLessThan(1e-6);
  });
});

describe('PoseFilter', () => {
  it('takes the first pose as-is, then converges smoothly', () => {
    const f = new PoseFilter();
    expect(f.current).toBeNull();
    f.update(new Matrix4(), 1 / 60);
    const target = new Matrix4().makeTranslation(0.01, 0, 0); // small move: normal smoothing
    const after1 = f.update(target, 1 / 60);
    const x1 = new Vector3().setFromMatrixPosition(after1).x;
    expect(x1).toBeGreaterThan(0);
    expect(x1).toBeLessThan(0.002);
    for (let i = 0; i < 120; i++) f.update(target, 1 / 60);
    expect(new Vector3().setFromMatrixPosition(f.current!).x).toBeCloseTo(0.01, 5);
  });

  it('re-snaps faster after a large jump', () => {
    const slow = new PoseFilter();
    slow.update(new Matrix4(), 0);
    const small = new Matrix4().makeTranslation(0.04, 0, 0);
    const big = new Matrix4().makeTranslation(0.2, 0, 0);
    const fracSmall = new Vector3().setFromMatrixPosition(slow.update(small, 1 / 30)).x / 0.04;
    const fast = new PoseFilter();
    fast.update(new Matrix4(), 0);
    const fracBig = new Vector3().setFromMatrixPosition(fast.update(big, 1 / 30)).x / 0.2;
    expect(fracBig).toBeGreaterThan(fracSmall * 2);
    expect(fracBig).toBeLessThan(1); // still smooth, not a teleport
  });
});

describe('composeWorldFromModel', () => {
  const identity = new Matrix4().elements.slice();

  it('applies calibration nudges in millimetres', () => {
    const m = composeWorldFromModel(
      new Matrix4(),
      { dxMm: 10, dyMm: 0, dzMm: -5, yawDeg: 0 },
      identity,
    );
    const p = new Vector3().setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(0.01, 9);
    expect(p.z).toBeCloseTo(-0.005, 9);
  });

  it('yaws about the mat origin, counter-clockwise seen from above', () => {
    const m = composeWorldFromModel(
      new Matrix4(),
      { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 90 },
      identity,
    );
    const p = new Vector3(0.1, 0, 0).applyMatrix4(m);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(-0.1, 9);
  });

  it('chains worldFromMat ∘ calibration ∘ objectToMat', () => {
    const objectToMat = new Matrix4().makeRotationX(-Math.PI / 2).elements.slice(); // Z-up STL → Y-up
    const m = composeWorldFromModel(
      TRUE_POSE,
      { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 },
      objectToMat,
    );
    const top = new Vector3(0, 0, 0.06).applyMatrix4(m); // top of a 60 mm cube in model coords
    const expected = new Vector3(0, 0.06, 0).applyMatrix4(TRUE_POSE);
    expect(top.distanceTo(expected)).toBeLessThan(1e-9);
  });
});
