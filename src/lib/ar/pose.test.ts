import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { markerItems } from '../mat/drawing';
import type { MarkerArt } from '../mat/markers';
import {
  composeWorldFromModel,
  estimateWorldFromMat,
  MAT_TARGET_ID,
  matFromImage,
  PoseFilter,
  printScales,
  rigidFit,
  trackTargets,
  type ImageConvention,
  type MarkerObservation,
  type TrackTarget,
} from './pose';

// A4 landscape: four 60 mm markers near the corners + the whole page as one image (mat XZ, mm)
const MAT = {
  markers: [
    [-108.5, -65],
    [108.5, -65],
    [-108.5, 65],
    [108.5, 65],
  ].map(([x, z], i) => ({
    id: `m${i}`,
    imagePath: '',
    widthMm: 60,
    centerMm: [x!, z!] as [number, number],
    rotationDeg: i === 3 ? 90 : 0,
    seed: i,
  })),
  trackImage: { imagePath: '', widthMm: 297, heightMm: 210, centerMm: [0, 0] as [number, number] },
};
const TARGETS = trackTargets(MAT);
const MARKERS_ONLY = trackTargets(MAT, { includeMatImage: false });
const byId = (id: string) => TARGETS.find((t) => t.id === id)!;

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
  targets: TrackTarget[],
  {
    noise,
    convention = 'spec',
  }: {
    noise?: { posM: number; angleDeg: number; seed: number };
    convention?: ImageConvention;
  } = {},
): MarkerObservation[] {
  const r = rng(noise?.seed ?? 1);
  return targets.map((t) => {
    const worldFromImage = worldFromMat.clone().multiply(matFromImage(t, convention));
    if (noise) {
      // a planar target's angular error shrinks with its size: `angleDeg` is for a 60 mm marker
      const angleDeg = noise.angleDeg * Math.min(1, 60 / t.widthMm);
      const q = new Quaternion().setFromAxisAngle(
        new Vector3(r(), r(), r()).normalize(),
        (angleDeg * Math.PI) / 180,
      );
      const p = new Vector3(r(), r(), r()).multiplyScalar(noise.posM);
      const pos = new Vector3();
      const rot = new Quaternion();
      worldFromImage.decompose(pos, rot, new Vector3());
      worldFromImage.compose(pos.add(p), q.multiply(rot), new Vector3(1, 1, 1));
    }
    return { markerId: t.id, worldFromImage, state: 'tracked' as const };
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
    // image-frame points (metres) at the right-edge centre and the bottom-edge centre
    const conventions: [ImageConvention, Vector3, Vector3][] = [
      ['arcore', new Vector3(0.03, 0, 0), new Vector3(0, 0, 0.03)], // +Z toward the bottom
      ['spec', new Vector3(0.03, 0, 0), new Vector3(0, -0.03, 0)], // +Y toward the top
    ];
    for (const [convention, rightPt, bottomPt] of conventions) {
      for (const rotationDeg of [0, 90, 30]) {
        const m = { centerMm: [40, -25] as [number, number], rotationDeg };
        const [item] = markerItems(art, m.centerMm, 60, rotationDeg, 't');
        if (item?.kind !== 'shape') throw new Error();
        const right = rightPt.clone().applyMatrix4(matFromImage(m, convention));
        const bottom = bottomPt.clone().applyMatrix4(matFromImage(m, convention));
        expect(right.x * 1000).toBeCloseTo(item.rings[0]![0]![0], 6);
        expect(right.z * 1000).toBeCloseTo(item.rings[0]![0]![1], 6);
        expect(bottom.x * 1000).toBeCloseTo(item.rings[0]![1]![0], 6);
        expect(bottom.z * 1000).toBeCloseTo(item.rings[0]![1]![1], 6);
        expect(right.y).toBeCloseTo(0, 9);
        expect(bottom.y).toBeCloseTo(0, 9);
      }
    }
  });

  it('puts the image normal along mat +Y in both conventions', () => {
    const m = { centerMm: [0, 0] as [number, number], rotationDeg: 0 };
    expect(new Vector3(0, 0, 1).transformDirection(matFromImage(m, 'spec')).y).toBeCloseTo(1, 9);
    expect(new Vector3(0, 1, 0).transformDirection(matFromImage(m, 'arcore')).y).toBeCloseTo(1, 9);
  });
});

describe('trackTargets', () => {
  it('lists markers then the whole-mat image, unless disabled', () => {
    expect(TARGETS.map((t) => t.id)).toEqual(['m0', 'm1', 'm2', 'm3', MAT_TARGET_ID]);
    expect(byId(MAT_TARGET_ID)).toMatchObject({ widthMm: 297, heightMm: 210, rotationDeg: 0 });
    expect(MARKERS_ONLY.map((t) => t.id)).toEqual(['m0', 'm1', 'm2', 'm3']);
    expect(trackTargets({ markers: MAT.markers }).map((t) => t.id)).toHaveLength(4);
  });
});

describe('estimateWorldFromMat', () => {
  const subsets: [string, TrackTarget[]][] = [
    ['one marker', [byId('m0')]],
    ['the rotated marker', [byId('m3')]],
    ['two markers', [byId('m0'), byId('m3')]],
    ['four markers', MARKERS_ONLY],
    ['the whole-mat image only', [byId(MAT_TARGET_ID)]],
    ['everything', TARGETS],
  ];

  it('recovers the exact pose from any subset, for either tracker convention', () => {
    for (const truth of ['spec', 'arcore'] as const) {
      for (const [, subset] of subsets) {
        for (const preferred of ['spec', 'arcore'] as const) {
          const est = estimateWorldFromMat(
            observe(TRUE_POSE, subset, { convention: truth }),
            TARGETS,
            preferred,
          )!;
          const e = poseError(est.worldFromMat, TRUE_POSE);
          expect(e.mm).toBeLessThan(1e-3);
          expect(e.deg).toBeLessThan(1e-3);
          expect(est.convention).toBe(truth);
          expect(est.used).toHaveLength(subset.length);
          if (subset.length >= 3) {
            // several images: the wrong convention cannot explain them all
            const wrong = truth === 'spec' ? 'arcore' : 'spec';
            expect(est.inliersByConvention[wrong]).toBeLessThan(subset.length);
            expect(est.decidedBy).toBe('inliers');
          }
        }
      }
    }
  });

  it('stays within ~3 mm at label height with realistic tracker noise', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const obs = observe(TRUE_POSE, MARKERS_ONLY, { noise: { posM: 0.002, angleDeg: 2, seed } });
      const est = estimateWorldFromMat(obs, TARGETS)!;
      expect(labelErrorMm(est.worldFromMat, TRUE_POSE)).toBeLessThan(3);
    }
  });

  it('gets better with more / bigger images (wide baseline)', () => {
    const total = { single: 0, markers: 0, all: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      const noise = { posM: 0.002, angleDeg: 2, seed };
      const obs = observe(TRUE_POSE, TARGETS, { noise });
      const err = (o: MarkerObservation[]) =>
        labelErrorMm(estimateWorldFromMat(o, TARGETS)!.worldFromMat, TRUE_POSE);
      total.single += err(obs.slice(0, 1));
      total.markers += err(obs.slice(0, 4));
      total.all += err(obs);
    }
    expect(total.markers).toBeLessThan(total.single / 2);
    expect(total.all).toBeLessThan(total.markers);
  });

  it('rejects an image whose pose is way off', () => {
    const obs = observe(TRUE_POSE, TARGETS);
    obs[2]!.worldFromImage.premultiply(new Matrix4().makeTranslation(0.1, 0, 0));
    const est = estimateWorldFromMat(obs, TARGETS)!;
    expect(est.rejected).toEqual(['m2']);
    expect(poseError(est.worldFromMat, TRUE_POSE).mm).toBeLessThan(1e-3);
  });

  it('trusts tracked images more than emulated ones', () => {
    const obs = observe(TRUE_POSE, [byId('m0'), byId('m1')]);
    obs[1]!.state = 'emulated';
    obs[1]!.worldFromImage.premultiply(new Matrix4().makeTranslation(0.01, 0, 0));
    const e = poseError(estimateWorldFromMat(obs, TARGETS)!.worldFromMat, TRUE_POSE).mm;
    expect(e).toBeGreaterThan(1);
    expect(e).toBeLessThan(3.5); // roughly 10 mm × 0.2 / 1.2
  });

  it('works from emulated images alone', () => {
    const obs = observe(TRUE_POSE, MARKERS_ONLY).map((o) => ({ ...o, state: 'emulated' as const }));
    expect(poseError(estimateWorldFromMat(obs, TARGETS)!.worldFromMat, TRUE_POSE).mm).toBeLessThan(
      1e-3,
    );
  });

  it('ignores unknown images and returns null with nothing tracked', () => {
    expect(estimateWorldFromMat([], TARGETS)).toBeNull();
    const obs = observe(TRUE_POSE, [byId('m0')]);
    obs[0]!.markerId = 'nope';
    expect(estimateWorldFromMat(obs, TARGETS)).toBeNull();
  });
});

describe('convention choice for ambiguous frames', () => {
  it('uses gravity when a single image cannot tell (mat lies flat on a table)', () => {
    for (const truth of ['spec', 'arcore'] as const) {
      const wrong = truth === 'spec' ? 'arcore' : 'spec';
      const est = estimateWorldFromMat(
        observe(TRUE_POSE, [byId('m1')], { convention: truth }),
        TARGETS,
        wrong, // even when the preference is wrong
      )!;
      expect(est.decidedBy).toBe('gravity');
      expect(est.convention).toBe(truth);
      expect(poseError(est.worldFromMat, TRUE_POSE).deg).toBeLessThan(1e-3);
    }
  });

  it('falls back to the preference when even gravity cannot tell (mat on a tilted stand)', () => {
    // tilt the mat 45° about X: both candidates are equally far from "up"
    const tilted = TRUE_POSE.clone().multiply(new Matrix4().makeRotationX(-Math.PI / 4));
    const est = estimateWorldFromMat(
      observe(tilted, [byId('m1')], { convention: 'arcore' }),
      TARGETS,
      'arcore',
    )!;
    expect(est.convention).toBe('arcore');
  });
});

describe('printScales', () => {
  it('reports measured / expected width for tracked images that report a size', () => {
    const obs = observe(TRUE_POSE, [byId('m0'), byId(MAT_TARGET_ID), byId('m1')]);
    obs[0]!.measuredWidthM = 0.057;
    obs[1]!.measuredWidthM = 0.297;
    obs[2]!.measuredWidthM = 0; // unknown
    const scales = printScales(obs, TARGETS);
    expect(scales.map((s) => s.id)).toEqual(['m0', MAT_TARGET_ID]);
    expect(scales[0]!.scale).toBeCloseTo(0.95, 6);
    expect(scales[1]!.scale).toBeCloseTo(1, 6);
  });
});

describe('rigidFit', () => {
  it('fits coplanar points', () => {
    const a = MAT.markers.map((m) => new Vector3(m.centerMm[0] / 1000, 0, m.centerMm[1] / 1000));
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
