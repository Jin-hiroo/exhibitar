import {
  difference as clipDifference,
  EndType,
  FillRule,
  inflatePaths,
  intersect as clipIntersect,
  JoinType,
  simplifyPaths,
  stripDuplicates,
  union as clipUnion,
  type Paths64,
} from '@countertype/clipper2-ts';

/**
 * Millimetre polygon operations on top of Clipper2 (integer coordinates).
 * Rings are arrays of [x, y] points; outer rings have positive signed area,
 * holes negative. Shared by footprint (WS-A) and mat layout (WS-B).
 *
 * Note: we use @countertype/clipper2-ts; the older `clipper2-js` port hangs
 * on unions of many overlapping triangles (e.g. a sphere's projected faces).
 */
export type Ring = [number, number][];
export type Polygons = Ring[];

/** 1 unit = 1 µm */
const SCALE = 1000;

export function toPaths64(polys: Polygons): Paths64 {
  return polys.map((ring) =>
    ring.map(([x, y]) => ({ x: Math.round(x * SCALE), y: Math.round(y * SCALE) })),
  );
}

export function fromPaths64(paths: Paths64): Polygons {
  const out: Polygons = [];
  for (const path of paths) {
    const clean = stripDuplicates(path, true);
    if (clean.length < 3) continue;
    out.push(clean.map((p) => [p.x / SCALE, p.y / SCALE]));
  }
  return out;
}

export function union(polys: Polygons): Polygons {
  return fromPaths64(clipUnion(toPaths64(polys), FillRule.NonZero));
}

export function intersect(a: Polygons, b: Polygons): Polygons {
  return fromPaths64(clipIntersect(toPaths64(a), toPaths64(b), FillRule.NonZero));
}

export function difference(a: Polygons, b: Polygons): Polygons {
  return fromPaths64(clipDifference(toPaths64(a), toPaths64(b), FillRule.NonZero));
}

/** Grow (delta > 0) or shrink (delta < 0) closed polygons by `deltaMm`. */
export function offset(
  polys: Polygons,
  deltaMm: number,
  join: 'miter' | 'round' = 'miter',
): Polygons {
  return fromPaths64(
    inflatePaths(
      toPaths64(polys),
      deltaMm * SCALE,
      join === 'miter' ? JoinType.Miter : JoinType.Round,
      EndType.Polygon,
      2,
      0.05 * SCALE,
    ),
  );
}

/** Remove vertices that deviate less than `epsMm` from the outline. */
export function simplify(polys: Polygons, epsMm: number): Polygons {
  return fromPaths64(simplifyPaths(toPaths64(polys), epsMm * SCALE, true));
}

export function signedArea(ring: Ring): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

/** Net area (outer rings minus holes). */
export function area(polys: Polygons): number {
  return polys.reduce((s, r) => s + signedArea(r), 0);
}

/** Drop rings (outer or hole) smaller than `minAreaMm2`. */
export function dropSmall(polys: Polygons, minAreaMm2: number): Polygons {
  return polys.filter((r) => Math.abs(signedArea(r)) >= minAreaMm2);
}

export function outerRingCount(polys: Polygons): number {
  return polys.filter((r) => signedArea(r) > 0).length;
}

export function bounds(polys: Polygons): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of polys) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

export function rect(x0: number, y0: number, x1: number, y1: number): Ring {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
