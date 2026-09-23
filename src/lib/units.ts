/**
 * The only place millimetres and metres meet (CLAUDE.md core idea #4).
 * STL / SVG / UI use millimetres; three.js / WebXR runtime uses metres.
 */

export const MM_PER_M = 1000;

export function mmToM(mm: number): number {
  return mm / MM_PER_M;
}

export function mToMm(m: number): number {
  return m * MM_PER_M;
}

/** Source units an exhibitor can pick for an STL, as millimetres per unit. */
export const UNIT_TO_MM = {
  mm: 1,
  cm: 10,
  inch: 25.4,
} as const;

export type LengthUnit = keyof typeof UNIT_TO_MM;

/**
 * Convert a rigid 4×4 transform (column-major, three.js `Matrix4.elements`)
 * whose translation is in millimetres to one whose translation is in metres.
 * The rotation block is unit-free and is copied unchanged.
 */
export function matrixMmToM(elements: ArrayLike<number>): number[] {
  return convertTranslation(elements, mmToM);
}

/** Inverse of {@link matrixMmToM}. */
export function matrixMToMm(elements: ArrayLike<number>): number[] {
  return convertTranslation(elements, mToMm);
}

function convertTranslation(elements: ArrayLike<number>, f: (v: number) => number): number[] {
  if (elements.length !== 16) {
    throw new Error(`expected 16 matrix elements, got ${elements.length}`);
  }
  const out = Array.from(elements);
  out[12] = f(out[12]!);
  out[13] = f(out[13]!);
  out[14] = f(out[14]!);
  return out;
}
