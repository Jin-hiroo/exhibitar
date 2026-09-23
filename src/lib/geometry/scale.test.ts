import { describe, expect, it } from 'vitest';
import { cube, toBinaryStl } from '../../../tests/fixtures/shapes';
import { parseStl } from './parse-stl';
import { applySourceScale, boundsMm, formatDimsMm, sourceScaleFor } from './scale';

describe('scale', () => {
  it('combines unit and uniform scale', () => {
    expect(sourceScaleFor('mm')).toBe(1);
    expect(sourceScaleFor('cm')).toBe(10);
    expect(sourceScaleFor('inch', 2)).toBeCloseTo(50.8);
    expect(() => sourceScaleFor('mm', 0)).toThrow();
    expect(() => sourceScaleFor('mm', NaN)).toThrow();
  });

  it('scales a mesh into millimetres', () => {
    const { mesh } = parseStl(toBinaryStl(cube(6))); // "6 cm" cube
    const mm = applySourceScale(mesh, sourceScaleFor('cm'));
    expect(boundsMm(mm).size).toEqual([60, 60, 60]);
    expect(applySourceScale(mesh, 1)).toBe(mesh);
  });

  it('formats dimensions', () => {
    expect(formatDimsMm([180, 140, 120])).toBe('180 × 140 × 120 mm');
    expect(formatDimsMm([60, 12.5, 7.25])).toBe('60 × 12.5 × 7.25 mm');
  });
});
