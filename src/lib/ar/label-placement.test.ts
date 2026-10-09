import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../types';
import {
  createLabelPlacer,
  LABEL_CLEARANCE_M,
  LABEL_OFFSET_M,
  type PlacementMesh,
} from './label-placement';

const AXES = { up: [0, 1, 0] as Vec3, front: [0, 0, 1] as Vec3 };

/** Axis-aligned boxes (metres) merged into one indexed mesh. */
function boxes(...list: [Vec3, Vec3][]): PlacementMesh {
  const positions: number[] = [];
  const index: number[] = [];
  for (const [lo, hi] of list) {
    const base = positions.length / 3;
    for (let i = 0; i < 8; i++) {
      positions.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]);
    }
    // two triangles per face: -x, +x, -y, +y, -z, +z
    const faces = [
      [0, 4, 6, 2],
      [1, 3, 7, 5],
      [0, 1, 5, 4],
      [2, 6, 7, 3],
      [0, 2, 3, 1],
      [4, 5, 7, 6],
    ];
    for (const [a, b, c, d] of faces) index.push(a!, b!, c!, a!, c!, d!);
    for (let i = index.length - 36; i < index.length; i++) index[i]! += base;
  }
  return { positions, index };
}

function sphere(center: Vec3, r: number, lon = 32, lat = 16): PlacementMesh {
  const positions: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= lat; j++) {
    const theta = (j * Math.PI) / lat;
    for (let i = 0; i < lon; i++) {
      const phi = (i * 2 * Math.PI) / lon;
      positions.push(
        center[0] + r * Math.sin(theta) * Math.cos(phi),
        center[1] + r * Math.cos(theta),
        center[2] + r * Math.sin(theta) * Math.sin(phi),
      );
    }
  }
  for (let j = 0; j < lat; j++) {
    for (let i = 0; i < lon; i++) {
      const a = j * lon + i;
      const b = j * lon + ((i + 1) % lon);
      index.push(a, a + lon, b, b, a + lon, b + lon);
    }
  }
  return { positions, index };
}

/** An open-top pocket: 30 mm square opening, 40 mm deep, 5 mm walls and floor. */
const POCKET = boxes(
  [
    [-0.02, 0, -0.02],
    [0.02, 0.005, 0.02],
  ],
  [
    [-0.02, 0, -0.02],
    [-0.015, 0.045, 0.02],
  ],
  [
    [0.015, 0, -0.02],
    [0.02, 0.045, 0.02],
  ],
  [
    [-0.015, 0, -0.02],
    [0.015, 0.045, -0.015],
  ],
  [
    [-0.015, 0, 0.015],
    [0.015, 0.045, 0.02],
  ],
);
const RIM_Y = 0.045;

describe('createLabelPlacer', () => {
  it('keeps the plain offset along the normal on a flat face', () => {
    const place = createLabelPlacer(
      boxes([
        [-0.1, 0, -0.1],
        [0.1, 0.01, 0.1],
      ]),
      AXES,
    );
    const p = place([0.02, 0.01, -0.03], [0, 1, 0]);
    expect(p[0]).toBeCloseTo(0.02, 9);
    expect(p[1]).toBeCloseTo(0.01 + LABEL_OFFSET_M, 9);
    expect(p[2]).toBeCloseTo(-0.03, 9);
  });

  it('keeps the plain offset on a convex surface', () => {
    const place = createLabelPlacer(sphere([0, 0.05, 0], 0.05), AXES);
    const p = place([0.05, 0.05, 0], [1, 0, 0]);
    expect(p[0]).toBeCloseTo(0.05 + LABEL_OFFSET_M, 9);
    expect(p[1]).toBeCloseTo(0.05, 9);
    expect(p[2]).toBeCloseTo(0, 9);
  });

  it('lifts a label out of a deep pocket instead of burying it', () => {
    const place = createLabelPlacer(POCKET, AXES);
    const p = place([0, 0.005, 0], [0, 1, 0]);
    expect(p[1]).toBeGreaterThanOrEqual(RIM_Y + LABEL_CLEARANCE_M - 1e-9);
    expect(p[0]).toBeCloseTo(0, 9);
    expect(p[2]).toBeCloseTo(0, 9);
  });

  it('escapes a pocket side wall through the opening, not through the opposite wall', () => {
    const place = createLabelPlacer(POCKET, AXES);
    const p = place([-0.015, 0.025, 0], [1, 0, 0]);
    expect(p[1]).toBeGreaterThan(RIM_Y);
    expect(p[0]).toBeLessThan(0.015);
  });

  it('escapes a recess facing the visitor (an eye socket) through its opening', () => {
    // a 30 x 30 mm recess, 30 mm deep, in the FRONT (+Z) face of a block
    const block = boxes(
      [
        [-0.04, 0, -0.04],
        [0.04, 0.08, -0.03],
      ],
      [
        [-0.04, 0, -0.03],
        [-0.015, 0.08, 0],
      ],
      [
        [0.015, 0, -0.03],
        [0.04, 0.08, 0],
      ],
      [
        [-0.015, 0, -0.03],
        [0.015, 0.025, 0],
      ],
      [
        [-0.015, 0.055, -0.03],
        [0.015, 0.08, 0],
      ],
    );
    const place = createLabelPlacer(block, AXES);
    // on the recess floor, facing up at its ceiling
    const p = place([0, 0.025, -0.015], [0, 1, 0]);
    expect(p[2]).toBeGreaterThan(0); // in front of the face
    expect(p[1]).toBeGreaterThanOrEqual(0.025 - 1e-9);
    expect(p[1]).toBeLessThan(0.055); // out through the opening, not over the top
  });

  it('never routes a label through the model or to the far side of its surface', () => {
    // anchor under a 2 mm shelf, facing down at a block 10 mm below
    const shelf = boxes(
      [
        [-0.05, 0.03, -0.05],
        [0.05, 0.032, 0.05],
      ],
      [
        [-0.05, 0, -0.05],
        [0.05, 0.02, 0.05],
      ],
    );
    const place = createLabelPlacer(shelf, AXES);
    const p = place([0, 0.03, 0], [0, -1, 0]);
    expect(p[1]).toBeLessThanOrEqual(0.03); // not above the shelf
    expect(p[1]).toBeGreaterThan(0.02); // not through the block
    expect(Math.max(Math.abs(p[0]), Math.abs(p[2]))).toBeGreaterThan(0.05); // out of the gap
  });

  it('handles non-indexed meshes', () => {
    const m = boxes([
      [-0.1, 0, -0.1],
      [0.1, 0.01, 0.1],
    ]);
    const flat = Array.from(m.index!, (i) => [0, 1, 2].map((k) => m.positions[i * 3 + k]!)).flat();
    const place = createLabelPlacer({ positions: flat, index: null }, AXES);
    expect(place([0, 0.01, 0], [0, 1, 0])[1]).toBeCloseTo(0.01 + LABEL_OFFSET_M, 9);
  });
});
