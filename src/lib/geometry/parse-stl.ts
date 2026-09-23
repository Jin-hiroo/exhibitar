import { compactMesh, type IndexedMesh } from './mesh';

/** STLs above this triangle count still parse, but the user is warned. */
export const LARGE_TRIANGLE_COUNT = 5_000_000;

/** Vertices closer than this (mm) are merged. STL duplicates are usually bit-identical. */
const MERGE_EPSILON = 1e-4;

export class StlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StlParseError';
  }
}

export interface StlStats {
  format: 'binary' | 'ascii';
  inputTriangles: number;
  triangles: number;
  vertices: number;
  /** triangles dropped because two corners merged into one vertex */
  degenerateTriangles: number;
  /** edges used by exactly one triangle (holes) */
  openEdges: number;
  /** edges used by more than two triangles */
  nonManifoldEdges: number;
}

export interface ParsedStl {
  mesh: IndexedMesh;
  stats: StlStats;
  warnings: string[];
}

/**
 * Parse a binary or ASCII STL into an indexed mesh with merged vertices.
 * Coordinates are kept exactly as in the file (no axis swap, no scaling).
 * Runs locally only: the STL never leaves the exhibitor's browser.
 */
export function parseStl(data: ArrayBuffer): ParsedStl {
  const { soup, format } = readTriangleSoup(data);
  const inputTriangles = soup.length / 9;
  if (inputTriangles === 0) throw new StlParseError('The STL contains no triangles.');
  for (let i = 0; i < soup.length; i++) {
    if (!Number.isFinite(soup[i]!)) {
      throw new StlParseError('The STL contains invalid (NaN or infinite) coordinates.');
    }
  }

  const merged = mergeVertices(soup, MERGE_EPSILON);
  const { degenerate } = merged;
  // dropping degenerate triangles can orphan vertices
  const { positions, indices } =
    degenerate > 0 ? compactMesh(merged.positions, merged.indices) : merged;
  if (indices.length === 0) {
    throw new StlParseError('Every triangle in the STL is degenerate.');
  }
  const { open, nonManifold } = edgeStats(indices, positions.length / 3);

  const warnings: string[] = [];
  if (inputTriangles > LARGE_TRIANGLE_COUNT) {
    warnings.push(
      `Large model: ${inputTriangles.toLocaleString('en-US')} triangles. Processing may be slow.`,
    );
  }
  if (open > 0) {
    warnings.push(
      `The mesh is not watertight (${open} open edges). Outlines may be less accurate.`,
    );
  }
  if (nonManifold > 0) {
    warnings.push(`The mesh has ${nonManifold} non-manifold edges.`);
  }

  return {
    mesh: { positions, indices },
    stats: {
      format,
      inputTriangles,
      triangles: indices.length / 3,
      vertices: positions.length / 3,
      degenerateTriangles: degenerate,
      openEdges: open,
      nonManifoldEdges: nonManifold,
    },
    warnings,
  };
}

function readTriangleSoup(data: ArrayBuffer): {
  soup: Float32Array;
  format: 'binary' | 'ascii';
} {
  if (data.byteLength >= 84) {
    const n = new DataView(data).getUint32(80, true);
    if (84 + 50 * n === data.byteLength) return { soup: readBinary(data, n), format: 'binary' };
  }
  const head = new TextDecoder().decode(new Uint8Array(data, 0, Math.min(data.byteLength, 512)));
  if (/^\s*solid\b/.test(head)) return { soup: readAscii(data), format: 'ascii' };
  throw new StlParseError('Not an STL file (neither valid binary nor ASCII STL).');
}

function readBinary(data: ArrayBuffer, n: number): Float32Array {
  const view = new DataView(data);
  const soup = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12; // skip the stored normal; it is often wrong
    for (let k = 0; k < 9; k++) soup[t * 9 + k] = view.getFloat32(o + k * 4, true);
  }
  return soup;
}

function readAscii(data: ArrayBuffer): Float32Array {
  const text = new TextDecoder().decode(data);
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  const values: number[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    values.push(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  if (values.length % 9 !== 0) {
    throw new StlParseError('Malformed ASCII STL: vertex count is not a multiple of 3.');
  }
  return new Float32Array(values);
}

/**
 * Merge vertices whose quantised coordinates are equal, using an
 * open-addressing hash table (fast enough for multi-million-triangle STLs).
 */
function mergeVertices(
  soup: Float32Array,
  eps: number,
): { positions: Float32Array; indices: Uint32Array; degenerate: number } {
  const nIn = soup.length / 3;
  let cap = 1;
  while (cap < nIn * 2) cap <<= 1;
  const mask = cap - 1;
  const table = new Int32Array(cap).fill(-1);
  const qx = new Float64Array(nIn);
  const qy = new Float64Array(nIn);
  const qz = new Float64Array(nIn);
  const positions = new Float32Array(nIn * 3);
  const vertexOf = new Uint32Array(nIn);
  let unique = 0;

  for (let i = 0; i < nIn; i++) {
    const x = soup[i * 3]!;
    const y = soup[i * 3 + 1]!;
    const z = soup[i * 3 + 2]!;
    const kx = Math.round(x / eps);
    const ky = Math.round(y / eps);
    const kz = Math.round(z / eps);
    let h =
      (Math.imul(kx | 0, 73856093) ^ Math.imul(ky | 0, 19349663) ^ Math.imul(kz | 0, 83492791)) &
      mask;
    for (;;) {
      const slot = table[h]!;
      if (slot === -1) {
        table[h] = unique;
        qx[unique] = kx;
        qy[unique] = ky;
        qz[unique] = kz;
        positions[unique * 3] = x;
        positions[unique * 3 + 1] = y;
        positions[unique * 3 + 2] = z;
        vertexOf[i] = unique++;
        break;
      }
      if (qx[slot] === kx && qy[slot] === ky && qz[slot] === kz) {
        vertexOf[i] = slot;
        break;
      }
      h = (h + 1) & mask;
    }
  }

  const indices = new Uint32Array(nIn);
  let n = 0;
  let degenerate = 0;
  for (let t = 0; t < nIn / 3; t++) {
    const a = vertexOf[t * 3]!;
    const b = vertexOf[t * 3 + 1]!;
    const c = vertexOf[t * 3 + 2]!;
    if (a === b || b === c || a === c) {
      degenerate++;
      continue;
    }
    indices[n++] = a;
    indices[n++] = b;
    indices[n++] = c;
  }
  return {
    positions: positions.slice(0, unique * 3),
    indices: indices.slice(0, n),
    degenerate,
  };
}

function edgeStats(indices: Uint32Array, nVerts: number): { open: number; nonManifold: number } {
  const counts = new Map<number, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e]!;
      const b = indices[t + ((e + 1) % 3)]!;
      const key = a < b ? a * nVerts + b : b * nVerts + a;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let open = 0;
  let nonManifold = 0;
  for (const c of counts.values()) {
    if (c === 1) open++;
    else if (c > 2) nonManifold++;
  }
  return { open, nonManifold };
}
