/**
 * Procedural test shapes and an STL writer (binary + ASCII).
 *
 * All shapes use the usual STL convention: millimetres, Z-up, resting on z = 0
 * "as sliced". Output is a triangle soup: 9 floats (3 vertices) per triangle,
 * counter-clockwise when viewed from outside.
 */

export type TriangleSoup = Float32Array;
type V3 = [number, number, number];
type V2 = [number, number];

// ---------------------------------------------------------------------------
// Builders

/** Extrude a simple polygon (XY, any winding) along +Z from z0 to z1. */
export function extrudePolygon(poly: V2[], z0: number, z1: number): number[] {
  const ccw = signedArea(poly) > 0 ? poly : [...poly].reverse();
  const out: number[] = [];
  for (const [a, b, c] of earClip(ccw)) {
    // top cap faces +Z (CCW), bottom cap faces −Z (reversed)
    out.push(a[0], a[1], z1, b[0], b[1], z1, c[0], c[1], z1);
    out.push(a[0], a[1], z0, c[0], c[1], z0, b[0], b[1], z0);
  }
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i]!;
    const b = ccw[(i + 1) % ccw.length]!;
    out.push(a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1);
    out.push(a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1);
  }
  return out;
}

export function box(min: V3, max: V3): number[] {
  const rect: V2[] = [
    [min[0], min[1]],
    [max[0], min[1]],
    [max[0], max[1]],
    [min[0], max[1]],
  ];
  return extrudePolygon(rect, min[2], max[2]);
}

/** 60 mm cube centred on the origin in XY, resting on z = 0. */
export function cube(size = 60): TriangleSoup {
  const h = size / 2;
  return new Float32Array(box([-h, -h, 0], [h, h, size]));
}

/**
 * L-shaped block. Profile in XY, extruded 40 mm along Z (so it rests on the
 * L-shaped face as sliced, contact area 3200 mm²). Its largest real flat face
 * is the y = 0 side (100 × 40 = 4000 mm²), which orientation should prefer.
 */
export function lBlock(): TriangleSoup {
  const profile: V2[] = [
    [0, 0],
    [100, 0],
    [100, 20],
    [20, 20],
    [20, 80],
    [0, 80],
  ];
  return new Float32Array(extrudePolygon(profile, 0, 40));
}

/**
 * 60 × 60 × 5 mm plate at z = 10..15 on three 6 × 6 mm feet (z = 0..10.5,
 * overlapping the plate slightly). Separate shells, like many real STLs.
 */
export function tripod(): TriangleSoup {
  const out = box([-30, -30, 10], [30, 30, 15]);
  for (const deg of [90, 210, 330]) {
    const a = (deg * Math.PI) / 180;
    const cx = 20 * Math.cos(a);
    const cy = 20 * Math.sin(a);
    out.push(...box([cx - 3, cy - 3, 0], [cx + 3, cy + 3, 10.5]));
  }
  return new Float32Array(out);
}

/**
 * Sphere (radius 30) with its bottom cut flat at z = 0 so it rests on a disc
 * of radius `capRadius`. `segments` × `rings` controls the triangle count.
 */
export function sphereOnFlat({
  radius = 30,
  capRadius = 15,
  segments = 48,
  rings = 24,
}: { radius?: number; capRadius?: number; segments?: number; rings?: number } = {}): TriangleSoup {
  const d = Math.sqrt(radius * radius - capRadius * capRadius); // centre height above cut
  const phiCut = Math.PI - Math.acos(d / radius); // polar angle of the cut ring (from +Z)
  const centre: V3 = [0, 0, d];
  const ring = (i: number): V3[] => {
    const phi = (phiCut * i) / rings;
    const pts: V3[] = [];
    for (let j = 0; j < segments; j++) {
      const th = (2 * Math.PI * j) / segments;
      pts.push([
        radius * Math.sin(phi) * Math.cos(th),
        radius * Math.sin(phi) * Math.sin(th),
        d + radius * Math.cos(phi),
      ]);
    }
    return pts;
  };
  const tris: V3[][] = [];
  let prev = ring(0); // all points at the pole
  for (let i = 1; i <= rings; i++) {
    const cur = ring(i);
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      if (i > 1) tris.push([prev[j]!, prev[k]!, cur[k]!]);
      tris.push([prev[j]!, cur[k]!, cur[j]!]);
    }
    prev = cur;
  }
  // flat cap at z = 0 (last ring), fan around the cap centre
  const bottom: V3 = [0, 0, 0];
  for (let j = 0; j < segments; j++) {
    tris.push([bottom, prev[(j + 1) % segments]!, prev[j]!]);
  }
  const out: number[] = [];
  for (const t of tris) {
    const [a, b, c] = orientOutward(t as [V3, V3, V3], t[0] === bottom ? [0, 0, 1] : centre);
    // snap the cut ring exactly onto z = 0
    for (const v of [a, b, c]) out.push(v[0], v[1], Math.abs(v[2]) < 1e-9 ? 0 : v[2]);
  }
  return new Float32Array(out);
}

// ---------------------------------------------------------------------------
// STL writers

export function toBinaryStl(tris: TriangleSoup, header = 'exhibitar fixture'): ArrayBuffer {
  const n = tris.length / 9;
  const buf = new ArrayBuffer(84 + 50 * n);
  const view = new DataView(buf);
  const head = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buf, 0, 80).set(head);
  view.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < n; t++) {
    const nrm = triNormal(tris, t);
    for (const v of nrm) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    for (let k = 0; k < 9; k++) {
      view.setFloat32(o, tris[t * 9 + k]!, true);
      o += 4;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

export function toAsciiStl(tris: TriangleSoup, name = 'fixture'): string {
  const n = tris.length / 9;
  const lines = [`solid ${name}`];
  const f = (x: number) => x.toExponential(6);
  for (let t = 0; t < n; t++) {
    const [nx, ny, nz] = triNormal(tris, t);
    lines.push(`  facet normal ${f(nx)} ${f(ny)} ${f(nz)}`, '    outer loop');
    for (let v = 0; v < 3; v++) {
      const i = t * 9 + v * 3;
      lines.push(`      vertex ${f(tris[i]!)} ${f(tris[i + 1]!)} ${f(tris[i + 2]!)}`);
    }
    lines.push('    endloop', '  endfacet');
  }
  lines.push(`endsolid ${name}`, '');
  return lines.join('\n');
}

export const FIXTURES = {
  cube: () => cube(),
  'l-block': lBlock,
  tripod,
  'sphere-on-flat': () => sphereOnFlat(),
} as const;

// ---------------------------------------------------------------------------
// helpers

function triNormal(tris: TriangleSoup, t: number): V3 {
  const i = t * 9;
  const ux = tris[i + 3]! - tris[i]!;
  const uy = tris[i + 4]! - tris[i + 1]!;
  const uz = tris[i + 5]! - tris[i + 2]!;
  const vx = tris[i + 6]! - tris[i]!;
  const vy = tris[i + 7]! - tris[i + 1]!;
  const vz = tris[i + 8]! - tris[i + 2]!;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function orientOutward(t: [V3, V3, V3], inside: V3): [V3, V3, V3] {
  const [a, b, c] = t;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
  const w = [a[0] - inside[0], a[1] - inside[1], a[2] - inside[2]];
  return n[0]! * w[0]! + n[1]! * w[1]! + n[2]! * w[2]! >= 0 ? t : [a, c, b];
}

function signedArea(poly: V2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

/** Ear clipping for a simple CCW polygon (fine for small fixture profiles). */
function earClip(poly: V2[]): [V2, V2, V2][] {
  const idx = poly.map((_, i) => i);
  const out: [V2, V2, V2][] = [];
  const cross = (o: V2, a: V2, b: V2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inTri = (p: V2, a: V2, b: V2, c: V2) =>
    cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10_000) {
    for (let i = 0; i < idx.length; i++) {
      const a = poly[idx[(i + idx.length - 1) % idx.length]!]!;
      const b = poly[idx[i]!]!;
      const c = poly[idx[(i + 1) % idx.length]!]!;
      if (cross(a, b, c) <= 0) continue; // reflex
      const blocked = idx.some((j) => {
        const p = poly[j]!;
        return p !== a && p !== b && p !== c && inTri(p, a, b, c);
      });
      if (blocked) continue;
      out.push([a, b, c]);
      idx.splice(i, 1);
      break;
    }
  }
  out.push([poly[idx[0]!]!, poly[idx[1]!]!, poly[idx[2]!]!]);
  return out;
}
