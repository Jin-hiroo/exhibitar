import { Matrix4, Quaternion, Vector3 } from 'three';
import { ConvexHull, type Face } from 'three/examples/jsm/math/ConvexHull.js';
import { matrixMmToM } from '../units';
import { CONTACT_EPSILON_MM, findContactTriangles } from './contact';
import {
  centreOfMass,
  computeBounds,
  faceNormalsAndAreas,
  transformMesh,
  type IndexedMesh,
  type Vec3Tuple,
} from './mesh';

/** Quaternion as [x, y, z, w]. */
export type QuatTuple = [number, number, number, number];

export interface RestingCandidate {
  /** Outward normal of the resting face in model coords; it will point to −Y. */
  normal: Vec3Tuple;
  /** Area of the (convex) support polygon, mm². */
  hullAreaMm2: number;
  /** Area of real mesh faces lying in that plane, mm². */
  contactAreaMm2: number;
  /** Distance from the centre-of-mass projection to the support polygon edge (negative = tips over), mm. */
  marginMm: number;
  stable: boolean;
  /** Resting on the STL's −Z face, i.e. as it was sliced on the build plate. */
  asPrinted: boolean;
  score: number;
}

const COPLANAR_ANGLE_DEG = 1;
const COPLANAR_OFFSET_MM = 0.2;
const MAX_CANDIDATES = 24;
const AS_PRINTED_BONUS = 1.05;
const DOWN = new Vector3(0, -1, 0);

/**
 * Suggest resting faces: planes of the convex hull, ranked by the real flat
 * area touching the table and by stability (does the centre of mass project
 * inside the support polygon, and by how much). Input is the scaled mesh (mm).
 */
export function findRestingCandidates(mesh: IndexedMesh): RestingCandidate[] {
  const points: Vector3[] = [];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3) points.push(new Vector3(p[i], p[i + 1], p[i + 2]));
  const hull = new ConvexHull().setFromPoints(points);
  const groups = groupCoplanarFaces(hull.faces);

  const com = new Vector3(...centreOfMass(mesh));
  const size = computeBounds(p).size;
  const diag = Math.hypot(...size);
  const m0 = Math.max(1, 0.05 * diag); // margin at which a pose counts as fully stable
  const { normals: faceN, areas: faceA } = faceNormalsAndAreas(mesh);
  const cosTilt = Math.cos((30 * Math.PI) / 180);

  groups.sort((a, b) => b.area - a.area);
  const picked = groups.slice(0, MAX_CANDIDATES);
  const asPrinted = groups.find(
    (g) => g.normal.z < -Math.cos((COPLANAR_ANGLE_DEG * Math.PI) / 180),
  );
  if (asPrinted && !picked.includes(asPrinted)) picked.push(asPrinted);

  const out: RestingCandidate[] = [];
  const dots = new Float32Array(p.length / 3);
  for (const g of picked) {
    const n = g.normal;
    let d = -Infinity;
    for (let v = 0; v < dots.length; v++) {
      dots[v] = n.x * p[v * 3]! + n.y * p[v * 3 + 1]! + n.z * p[v * 3 + 2]!;
      if (dots[v]! > d) d = dots[v]!;
    }
    // real contact area: faces in the plane, facing the same way
    let contact = 0;
    const ix = mesh.indices;
    for (let t = 0; t < ix.length / 3; t++) {
      if (
        d - dots[ix[t * 3]!]! > CONTACT_EPSILON_MM ||
        d - dots[ix[t * 3 + 1]!]! > CONTACT_EPSILON_MM ||
        d - dots[ix[t * 3 + 2]!]! > CONTACT_EPSILON_MM
      )
        continue;
      const dn = faceN[t * 3]! * n.x + faceN[t * 3 + 1]! * n.y + faceN[t * 3 + 2]! * n.z;
      if (dn >= cosTilt) contact += faceA[t]!;
    }
    const { u, w } = planeBasis(n);
    const poly = convexHull2d(g.points.map((q) => [q.dot(u), q.dot(w)] as [number, number]));
    const margin = signedDistanceInside([com.dot(u), com.dot(w)], poly);
    const stable = margin > 0;
    const isAsPrinted = g === asPrinted;
    const stability = stable ? Math.min(1, margin / m0) : 0.05;
    out.push({
      normal: [n.x, n.y, n.z],
      hullAreaMm2: polygonArea(poly),
      contactAreaMm2: contact,
      marginMm: margin,
      stable,
      asPrinted: isAsPrinted,
      score: contact * stability * (isAsPrinted ? AS_PRINTED_BONUS : 1),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Rotation that turns `normal` (outward, model coords) straight down, then yaws about Y for FRONT. */
export function restingRotation(normal: Vec3Tuple, frontYawDeg = 0): QuatTuple {
  const rest = new Quaternion().setFromUnitVectors(new Vector3(...normal).normalize(), DOWN);
  const yaw = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    (frontYawDeg * Math.PI) / 180,
  );
  const q = yaw.multiply(rest);
  return [q.x, q.y, q.z, q.w];
}

/** Compose an extra user rotation (e.g. 90° steps, free rotate) after `base`. */
export function composeRotation(base: QuatTuple, extra: QuatTuple): QuatTuple {
  const q = new Quaternion(...extra).multiply(new Quaternion(...base));
  return [q.x, q.y, q.z, q.w];
}

export interface Orientation {
  /** model (mm) → mat (mm), column-major */
  objectToMatMm: number[];
  /** model (m) → mat (m), column-major: `Project.objectToMat` */
  objectToMat: number[];
  /** the mesh in the mat frame, mm */
  oriented: IndexedMesh;
}

/**
 * Rotate, drop so the lowest point touches y = 0, and centre the contact
 * outline's bounding box on the mat origin (ARCHITECTURE.md §2).
 */
export function applyOrientation(mesh: IndexedMesh, rotation: QuatTuple): Orientation {
  const r = new Matrix4().makeRotationFromQuaternion(new Quaternion(...rotation).normalize());
  const rotated = transformMesh(mesh, r.elements);
  const { minY, bounds } = findContactTriangles(rotated);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const m = new Matrix4().makeTranslation(-cx, -minY, -cz).multiply(r);
  const objectToMatMm = Array.from(m.elements);
  return {
    objectToMatMm,
    objectToMat: matrixMmToM(objectToMatMm),
    oriented: transformMesh(mesh, objectToMatMm),
  };
}

// ---------------------------------------------------------------------------

interface PlaneGroup {
  normal: Vector3;
  area: number;
  points: Vector3[];
}

/** Flood-fill adjacent hull faces that share a plane. */
function groupCoplanarFaces(faces: Face[]): PlaneGroup[] {
  const cosTol = Math.cos((COPLANAR_ANGLE_DEG * Math.PI) / 180);
  const seen = new Set<Face>();
  const groups: PlaneGroup[] = [];
  for (const seed of faces) {
    if (seen.has(seed)) continue;
    seen.add(seed);
    const members: Face[] = [];
    const stack = [seed];
    while (stack.length) {
      const f = stack.pop()!;
      members.push(f);
      let e = f.edge;
      do {
        const nb = e.twin?.face;
        if (
          nb &&
          !seen.has(nb) &&
          nb.normal.dot(seed.normal) > cosTol &&
          Math.abs(nb.constant - seed.constant) < COPLANAR_OFFSET_MM
        ) {
          seen.add(nb);
          stack.push(nb);
        }
        e = e.next;
      } while (e !== f.edge);
    }
    const normal = new Vector3();
    let area = 0;
    const points: Vector3[] = [];
    for (const f of members) {
      normal.addScaledVector(f.normal, f.area);
      area += f.area;
      let e = f.edge;
      do {
        points.push(e.head().point);
        e = e.next;
      } while (e !== f.edge);
    }
    groups.push({ normal: normal.normalize(), area, points });
  }
  return groups;
}

function planeBasis(n: Vector3): { u: Vector3; w: Vector3 } {
  const ref = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const u = new Vector3().crossVectors(n, ref).normalize();
  const w = new Vector3().crossVectors(n, u).normalize();
  return { u, w };
}

type P2 = [number, number];

/** Andrew's monotone chain; returns CCW hull without repeating the first point. */
export function convexHull2d(pts: P2[]): P2[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const cross = (o: P2, a: P2, b: P2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const q of s) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 1e-9
    )
      lower.pop();
    lower.push(q);
  }
  const upper: P2[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const q = s[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 1e-9
    )
      upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function polygonArea(poly: P2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** Positive inside a CCW convex polygon (distance to nearest edge), negative outside. */
function signedDistanceInside(q: P2, poly: P2[]): number {
  if (poly.length < 3) return -Infinity;
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len === 0) continue;
    const side = (ex * (q[1] - a[1]) - ey * (q[0] - a[0])) / len; // >0 left of edge = inside for CCW
    if (side < 0) inside = false;
    // distance to the segment
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / (len * len)));
    const dist = Math.hypot(q[0] - (a[0] + t * ex), q[1] - (a[1] + t * ey));
    best = Math.min(best, dist);
  }
  return inside ? best : -best;
}
