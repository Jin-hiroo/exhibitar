# ARCHITECTURE

## 1. Overview

```text
                 ┌──────────────── Vercel (Next.js) ────────────────┐
 Exhibitor ──▶   │ /studio/**   Studio (auth)                        │
 (desktop)       │   STL → [Workers: parse, orient, simplify,        │
                 │          footprint, mat SVG, markers] → publish   │
                 │                                                   │
 Audience  ──▶   │ /v/[id]      Viewer (public, mobile)              │
 (phone)         │   GLB + mat + annotations → WebXR image tracking  │
                 └───────────────┬───────────────────────────────────┘
                                 │
                        Supabase: Auth · Postgres · Storage
```

Everything heavy is client-side. Server code (Route Handlers / Server Actions)
only does auth, CRUD on projects, and signed upload URLs.

## 2. Coordinate systems (critical)

**Mat frame = world.** Right-handed, Y-up (three.js convention).

- Origin: centre of the mat's contact-outline bounding box (the object's
  footprint centre) on the paper surface.
- Paper plane: XZ. +Y points up out of the paper.
- +Z points toward the **FRONT** edge of the mat; +X to the right when facing FRONT.
- Runtime units: metres. SVG/UI units: millimetres.

**Object transform** (`objectToMat`, 4×4): maps the simplified model's own
coordinates into the mat frame. Produced by the orientation step:
rotate → drop to y=0 → centre footprint on origin. Stored per project.

**Marker poses** (`markers[i].centerMm`, `rotationDeg`, `widthMm`): each
marker's centre and in-plane rotation in the mat frame. Known exactly because
the app generated the SVG.

**Calibration offset** (`calibration`): small correction applied *after*
`objectToMat`: `{ dxMm, dyMm, dzMm, yawDeg }`. Default zero.

Runtime chain in the Viewer:

```text
worldFromMat   = estimated from tracked marker pose(s) ∘ inverse(markerPoseInMat)
worldFromModel = worldFromMat ∘ calibration ∘ objectToMat
```

Annotations are stored in **model coordinates** (so calibration and
orientation changes don't require rewriting them).

## 3. Data model (`src/lib/types.ts`)

```ts
type Vec3 = [number, number, number];

interface Project {
  id: string;                 // short, URL-safe (e.g. nanoid 10)
  ownerId: string;
  title: string;
  description?: string;
  status: 'draft' | 'published';
  createdAt: string; updatedAt: string;
  geometryVersion: number;    // bump when model/orientation changes → mat invalid

  model: {
    glbPath: string;          // storage path of simplified GLB (model coords, metres)
    triangleCount: number;
    boundsMm: { size: Vec3 };
    sourceScale: number;      // unit/scale factor applied to the STL
  };
  objectToMat: number[];      // 16 numbers, column-major (three.js Matrix4.elements)
  calibration: { dxMm: number; dyMm: number; dzMm: number; yawDeg: number };

  mat: {
    paper: 'A4' | 'A3' | 'Letter' | 'Tabloid';
    orientation: 'portrait' | 'landscape';
    tiles: { cols: number; rows: number };
    sizeMm: [number, number];         // full mat size
    svgPath: string;
    contactOutlineMm: [number, number][][];  // polygons, mat XZ plane
    shadowOutlineMm: [number, number][][];
    markers: Marker[];
    trackImage?: TrackImage;          // the whole printed page as one extra tracking image
  };

  annotations: Annotation[];
}

interface TrackImage {                // rendered from the same drawing as the SVG
  imagePath: string;
  widthMm: number; heightMm: number;
  centerMm: [number, number];         // page centre in mat XZ (page-aligned, unrotated)
}

interface Marker {
  id: string;
  imagePath: string;          // PNG used by the tracker (same art as in SVG)
  widthMm: number;            // physical printed width
  centerMm: [number, number]; // mat XZ
  rotationDeg: number;        // in-plane rotation
  seed: number;               // generator seed (reproducible)
}

type Annotation = {
  id: string;
  order: number;
  title: string;
  body: string;               // plain text / light markdown
  imagePath?: string;
  link?: string;
  anchor: { position: Vec3; normal: Vec3 };   // model coords
} & (
  | { kind: 'point' }
  | { kind: 'region'; triangles: number[] }   // indices into the stored GLB
);
```

Postgres: `projects` table with scalar columns + `jsonb` for `model`, `mat`,
`calibration`, `annotations` (`supabase/migrations/`). Row Level Security: owner
can read/write. The public reads published projects through the security-definer
function `get_published_project(id)`, which returns only Viewer fields
(`ViewerProject`). A trigger keeps `id`/`owner_id` immutable and makes
`geometry_version` monotonic, bumping it whenever `model` or `object_to_mat`
change. `record_view(id)` counts views.

Storage buckets: `models/` (GLB), `mats/` (SVG, PDF, marker PNGs, track PNG,
QR), `annotation-media/`, all public-read. Object paths are
`<bucket>/<projectId>/<file>` with the geometry version in the file name
(immutable, cacheable); only the project's owner may write under its folder
(storage RLS). Project fields store these paths.

## 4. Studio pipeline (client-side, Web Workers)

1. **Parse** STL → indexed `BufferGeometry` (merge vertices, compute normals).
   Reject non-manifold garbage gracefully; warn on > 5M triangles.
2. **Scale** by unit choice.
3. **Orient**: candidate resting faces from convex hull faces weighted by
   area + stability (centre of mass projection inside the face). User override.
4. **Simplify** with meshoptimizer to a target (~20–50k triangles, tune for
   ≤ 1.5 MB GLB with meshopt/Draco compression). This mesh is then frozen.
5. **Footprint**:
   - Contact: triangles with all vertices within ε (≈ 0.3 mm) of min y and
     normals pointing down → project to XZ → union (clipper2).
   - Shadow: project all triangles of a further-decimated mesh to XZ → union.
   - Contact fallback: if contact area is tiny/fragmented, still draw it but
     also emphasise the shadow outline.
6. **Mat layout**: bounding box of shadow + margin; place 3–4 markers in free
   space (corners preferred, never overlapping shadow), QR, ruler, FRONT
   arrow, title. Choose paper/tiling.
7. **Markers**: procedurally generated, seeded, high-contrast, asymmetric,
   non-repeating art (e.g. random polygons/blobs/lines on a quiet border).
   Output both SVG (for the mat) and PNG (for the tracker) from the same
   seed. Include a quality check (feature/corner count, no rotational symmetry).
8. **SVG** in mm units (`width="297mm" viewBox="0 0 297 210"`). Also offer PDF.
9. **Publish**: upload GLB, SVG/PDF, PNGs (markers, whole-mat track image), QR
   directly from the browser (storage RLS); write the project row.

## 5. Viewer (AR)

- Entry `/v/[id]`: server-render landing card (title, description, Start AR).
  Prefetch GLB + marker PNGs.
- **AR session**: WebXR `immersive-ar` with `image-tracking`
  (`trackedImages: [{ image: ImageBitmap, widthInMeters }]`), `hit-test` optional,
  `dom-overlay` for UI. iPhone runs the same code inside Needle Go App Clip.
  (Verify both in Task D0.)
- **Tracked images**: the corner markers **and the whole printed page**
  (`mat.trackImage`). The page is a large target, so it is detected sooner and
  stays actively tracked at normal viewing distance, where the small markers
  often drop to "emulated".
- **Pose estimation** (`src/lib/ar/pose.ts`): each tracked image contributes its
  centre + 4 corners as point correspondences (mat frame ↔ world); one weighted
  rigid fit over all of them gives `worldFromMat` (works from a single image;
  large images and wide baselines dominate). The tracker's image axis convention
  (spec: +Y = image top, +Z = normal; ARCore: +Y = normal) is not assumed: both
  are fitted every frame and chosen by inliers → residual → gravity (the mat lies
  flat) → remembered preference; the device's convention is learned from
  decisive frames. Outlier images are dropped. Emulated (last known) poses are
  followed at low weight; a frame-rate-independent low-pass filter smooths and
  re-snaps quickly after jumps.
- **Occlusion**: render the GLB first with `colorWrite = false`,
  `depthWrite = true`, so labels/effects behind the real object are hidden.
- **Labels**: billboarded sprites/HTML at `anchor.position + normal * offset`.
  Fade by `dot(normal, toCamera)` and occlusion.
- **Region highlight**: sub-geometry from `triangles`, emissive/rim shader,
  slight polygon offset.
- **Tap**: raycast against the occluder mesh → nearest annotation / region.
- **Fallback**: no WebXR → orbit viewer (same scene, visible model).

## 6. Calibration mode

`/studio/[id]/calibrate` (auth, phone). Same AR runtime, but the model is
drawn semi-transparent. On-screen controls: ±1 mm / ±5 mm on X/Z, ±0.5°/±2° yaw,
optional Y. Save writes `calibration`. Show a "reset" button. Calibration is
applied about the mat origin (+yaw = counter-clockwise seen from above).

## 7. Routes

```text
/                         marketing/landing
/login                    Supabase auth (email magic link)
/auth/callback            magic-link landing (PKCE code or token hash)
/auth/signout             POST: sign out
/studio                   project list
/studio/new               upload → wizard
/studio/[id]              editor tabs: Setup · Mat · Annotate · Preview · Publish
/studio/[id]/calibrate    phone calibration AR
/v/[id]                   public Viewer
(no /api: the browser talks to Supabase directly; RLS enforces ownership)
```

## 8. Directory layout

```text
src/
  app/                    Next.js routes (see §7)
  lib/
    types.ts              shared types (owned by WS-0; change deliberately)
    units.ts
    geometry/             parse, orient, simplify, footprint   (WS-A)
    mat/                  layout, markers, svg, pdf, qr        (WS-B)
    annotations/          picking, painting, serialization     (WS-C)
    ar/                   session, tracking, pose fusion, occlusion, labels (WS-D)
    db/                   supabase client, queries             (WS-E)
  workers/                worker entrypoints wrapping lib/     (WS-A/B)
  components/
    studio/               (WS-C, WS-F)
    viewer/               (WS-D)
tests/
  fixtures/               generated STLs (cube, L-shape, tripod, sphere)
supabase/
  migrations/             (WS-E)
```

## 9. Performance budgets

- Studio: 1M-triangle STL processed to preview in < 15 s on a mid laptop.
- Viewer: GLB ≤ 1.5 MB, marker PNGs ≤ 200 KB each, first interaction < 3 s on 4G,
  steady 30+ fps on a mid-range phone.
