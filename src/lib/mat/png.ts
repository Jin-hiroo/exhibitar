import { zlibSync } from 'fflate';
import type { Raster } from './raster';

/** Encode an 8-bit grayscale raster as PNG (no filtering; zlib does the work). */
export function encodePng(r: Raster): Uint8Array {
  const raw = new Uint8Array((r.width + 1) * r.height);
  for (let y = 0; y < r.height; y++) {
    raw[y * (r.width + 1)] = 0; // filter: none
    raw.set(r.data.subarray(y * r.width, (y + 1) * r.width), y * (r.width + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, r.width);
  v.setUint32(4, r.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: grayscale
  const chunks = [
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ];
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const out = new Uint8Array(8 + chunks.reduce((s, c) => s + c.length, 0));
  out.set(sig, 0);
  let o = 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
