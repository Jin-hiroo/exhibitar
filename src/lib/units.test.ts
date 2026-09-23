import { describe, expect, it } from 'vitest';
import { matrixMmToM, matrixMToMm, mmToM, mToMm, UNIT_TO_MM } from './units';

describe('units', () => {
  it('converts mm ↔ m', () => {
    expect(mmToM(1500)).toBe(1.5);
    expect(mToMm(0.25)).toBe(250);
    expect(mToMm(mmToM(123.456))).toBeCloseTo(123.456, 10);
  });

  it('knows the supported source units', () => {
    expect(UNIT_TO_MM).toEqual({ mm: 1, cm: 10, inch: 25.4 });
  });

  it('converts only the translation of a matrix', () => {
    // rotation 90° about Y, translation (10, 20, 30) mm
    const m = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 10, 20, 30, 1];
    const inM = matrixMmToM(m);
    expect(inM.slice(0, 12)).toEqual(m.slice(0, 12));
    expect(inM.slice(12)).toEqual([0.01, 0.02, 0.03, 1]);
    expect(matrixMToMm(inM)).toEqual(m);
  });

  it('rejects non-4×4 input', () => {
    expect(() => matrixMmToM([1, 2, 3])).toThrow(/16/);
  });
});
