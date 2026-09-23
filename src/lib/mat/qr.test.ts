import { describe, expect, it } from 'vitest';
import { qrDrawItems, qrModuleCount, qrPng, viewerUrl } from './qr';

describe('qr', () => {
  it('builds the viewer URL', () => {
    expect(viewerUrl('https://exhibitar.vercel.app/', 'abc123')).toBe(
      'https://exhibitar.vercel.app/v/abc123',
    );
  });

  it('draws the symbol inside the requested square', () => {
    const url = viewerUrl('https://exhibitar.vercel.app', 'abcdefghij');
    const [item] = qrDrawItems(url, 10, 20, 24);
    expect(item?.kind).toBe('shape');
    if (item?.kind !== 'shape') return;
    const pts = item.rings.flat();
    expect(Math.min(...pts.map((p) => p[0]))).toBeCloseTo(10, 6);
    expect(Math.max(...pts.map((p) => p[0]))).toBeCloseTo(34, 6);
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(20, 6);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(44, 6);
    expect(qrModuleCount(url)).toBeGreaterThanOrEqual(21);
  });

  it('renders a PNG with quiet zone', () => {
    const png = qrPng('https://exhibitar.vercel.app/v/x', 4);
    const v = new DataView(png.buffer, png.byteOffset);
    const n = qrModuleCount('https://exhibitar.vercel.app/v/x');
    expect(v.getUint32(16)).toBe((n + 8) * 4);
  });
});
