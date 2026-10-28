import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { textWidthMm } from './display-list';

describe('textWidthMm', () => {
  it("follows the PDF font's widths (Helvetica, Helvetica Bold), never narrower", () => {
    const doc = new jsPDF({ unit: 'mm' });
    const samples = [
      'Cube',
      'SKULL OF A T-REX',
      'W'.repeat(25),
      'iiii llll',
      'Mock cube #3: 1/2 (left)',
    ];
    for (const bold of [false, true]) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      for (const s of samples) {
        // jsPDF's measure takes off kerning pairs (e.g. "T-"); ours doesn't, so never runs short
        const pdf = doc.getStringUnitWidth(s) * 6;
        expect(textWidthMm(s, 6, bold), s).toBeGreaterThanOrEqual(pdf - 1e-9);
        expect(textWidthMm(s, 6, bold), s).toBeLessThanOrEqual(pdf * 1.03);
      }
    }
  });

  it('counts other characters, e.g. Japanese, 1 em each', () => {
    expect(textWidthMm('恐竜の頭骨', 5)).toBeCloseTo(25, 9);
  });
});
