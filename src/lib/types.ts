/**
 * Shared data model (docs/ARCHITECTURE.md §3). Owned by WS-0.
 * Changing these types affects every workstream: do it deliberately and call
 * it out in the commit message.
 *
 * Units (CLAUDE.md core idea #4):
 * - Fields suffixed `Mm` are millimetres (STL / SVG / UI).
 * - Model coordinates (the stored GLB, `objectToMat`, `anchor.position`) are
 *   metres, because they feed the three.js / WebXR runtime directly.
 *
 * Frames (ARCHITECTURE.md §2): the mat frame is the world. Right-handed, Y-up,
 * paper in XZ, +Z toward the FRONT edge, origin at the centre of the contact
 * outline's bounding box.
 */

export type Vec3 = [number, number, number];

export interface Project {
  id: string; // short, URL-safe (e.g. nanoid 10)
  ownerId: string;
  title: string;
  description?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  geometryVersion: number; // bump when model/orientation changes → mat invalid

  model: {
    glbPath: string; // storage path of simplified GLB (model coords, metres)
    triangleCount: number;
    boundsMm: { size: Vec3 };
    sourceScale: number; // unit/scale factor applied to the STL
  };
  /**
   * 16 numbers, column-major (three.js Matrix4.elements). Maps model coords
   * (metres) into the mat frame (metres): rotate → drop to y=0 → centre
   * footprint on origin.
   */
  objectToMat: number[];
  /** Applied after `objectToMat`, about the mat origin. */
  calibration: { dxMm: number; dyMm: number; dzMm: number; yawDeg: number };

  mat: {
    paper: 'A4' | 'A3' | 'Letter' | 'Tabloid';
    orientation: 'portrait' | 'landscape';
    tiles: { cols: number; rows: number };
    sizeMm: [number, number]; // full mat size
    svgPath: string;
    contactOutlineMm: [number, number][][]; // polygons, mat XZ plane
    shadowOutlineMm: [number, number][][];
    markers: Marker[];
    /**
     * The whole printed page as one extra tracking image (optional). A large
     * target is detected sooner and tracked more steadily than the small
     * corner markers; it is rendered from the same drawing as the SVG.
     */
    trackImage?: TrackImage;
    /** Viewer URL encoded in the printed QR code (absent on mats made before it was recorded). */
    qrUrl?: string;
  };

  annotations: Annotation[];
}

export interface Marker {
  id: string;
  imagePath: string; // PNG used by the tracker (same art as in SVG)
  widthMm: number; // physical printed width
  centerMm: [number, number]; // mat XZ
  /** In-plane rotation, degrees, clockwise as seen on the printed page (SVG `rotate()`). */
  rotationDeg: number;
  seed: number; // generator seed (reproducible)
}

export interface TrackImage {
  imagePath: string; // PNG given to the tracker
  widthMm: number; // physical printed size of the whole image
  heightMm: number;
  centerMm: [number, number]; // image centre in mat XZ; unrotated (page-aligned)
}

export type Annotation = {
  id: string;
  order: number;
  title: string;
  body: string; // plain text / light markdown
  imagePath?: string;
  link?: string;
  anchor: { position: Vec3; normal: Vec3 }; // model coords (metres)
} & (
  | { kind: 'point' }
  | { kind: 'region'; triangles: number[] } // indices into the stored GLB
);

/**
 * The fields the public Viewer needs (ARCHITECTURE.md §3: "a public view that
 * exposes only Viewer-needed fields"). Never includes ownership or drafts.
 */
export type ViewerProject = Pick<
  Project,
  'id' | 'title' | 'description' | 'model' | 'objectToMat' | 'calibration' | 'mat' | 'annotations'
>;
