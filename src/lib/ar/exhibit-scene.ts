import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  SphereGeometry,
  Sprite,
  Vector3,
} from 'three';
import type { Annotation, ViewerProject } from '../types';
import { mmToM } from '../units';
import { createLabelSprite, drawLabel } from './labels';
import { matFromModel } from './pose';

/** Labels float this far off the surface, along the anchor normal (metres). */
const LABEL_OFFSET_M = 0.025;
/** On-screen label height as a fraction of the distance to the camera. */
const LABEL_HEIGHT_PER_M = 0.045;
const PICK_POINT_RADIUS_M = 0.03;

interface LabelEntry {
  annotation: Annotation;
  group: Group;
  sprite: Sprite;
  dot: Mesh;
  line: Line;
  anchor: Vector3;
  normal: Vector3;
  labelPos: Vector3;
}

/**
 * The exhibit's scene graph, in the mat frame:
 *
 *   root  (mat frame; AR sets its matrix to worldFromMat)
 *   └─ model  (matrix = calibration ∘ objectToMat; children in model coords)
 *      ├─ occluder   depth-only copy of the model: the real object hides labels
 *      ├─ ghost      translucent model + edges (calibration / "show model")
 *      ├─ highlight  selected region's triangles
 *      └─ labels
 *
 * Used by the AR runtime, the fallback 3D viewer and (later) the Studio preview.
 */
export class ExhibitScene {
  readonly root = new Group();
  readonly model = new Group();
  private readonly occluder: Mesh;
  private readonly ghost: Mesh;
  private readonly edges: LineSegments;
  private readonly labels: LabelEntry[] = [];
  private readonly debug = new Group();
  private readonly regionOfTriangle = new Map<number, string>();
  private highlight: Mesh | null = null;
  private selectedId: string | null = null;

  constructor(
    private readonly project: ViewerProject,
    private readonly geometry: BufferGeometry,
  ) {
    this.root.name = 'mat';
    this.root.matrixAutoUpdate = false;
    this.model.name = 'model';
    this.model.matrixAutoUpdate = false;
    this.model.matrix.copy(matFromModel(project.calibration, project.objectToMat));
    this.root.add(this.model);

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    this.occluder = new Mesh(
      geometry,
      new MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: DoubleSide }),
    );
    this.occluder.name = 'occluder';
    this.occluder.renderOrder = -1;
    this.model.add(this.occluder);

    this.ghost = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: 0x6aa8ff,
        roughness: 0.6,
        metalness: 0,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.ghost.name = 'ghost';
    this.ghost.renderOrder = 1;
    this.edges = new LineSegments(
      new EdgesGeometry(geometry, 25),
      new LineBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.9 }),
    );
    this.edges.renderOrder = 1;
    this.model.add(this.ghost, this.edges);
    this.setGhost(false);

    for (const a of project.annotations) {
      if (a.kind === 'region') for (const t of a.triangles) this.regionOfTriangle.set(t, a.id);
    }
    const ordered = [...project.annotations].sort((a, b) => a.order - b.order);
    ordered.forEach((a, i) => this.labels.push(this.buildLabel(a, i + 1)));

    this.buildDebug();
    this.debug.visible = false;
    this.root.add(this.debug);
  }

  /** Show the model itself (translucent), e.g. without the printed object or for calibration. */
  setGhost(visible: boolean, opacity = 0.45): void {
    const mat = this.ghost.material as MeshStandardMaterial;
    mat.opacity = opacity;
    mat.transparent = opacity < 1;
    mat.depthWrite = opacity >= 1;
    this.ghost.visible = visible;
    this.edges.visible = visible && opacity < 1;
  }

  /** Marker outlines, contact outline and mat axes, drawn where the app thinks they are. */
  setDebug(visible: boolean): void {
    this.debug.visible = visible;
  }

  get selected(): string | null {
    return this.selectedId;
  }

  select(id: string | null): void {
    if (id === this.selectedId) return;
    for (const l of this.labels) {
      const on = l.annotation.id === id;
      const was = l.annotation.id === this.selectedId;
      if (on !== was) drawLabel(l.sprite, { selected: on });
    }
    this.selectedId = id;
    if (this.highlight) {
      this.model.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight = null;
    }
    const a = this.project.annotations.find((x) => x.id === id);
    if (a?.kind === 'region' && a.triangles.length) {
      this.highlight = this.buildHighlight(a.triangles);
      this.model.add(this.highlight);
    }
  }

  /** Per frame: scale labels to a steady on-screen size and fade the ones seen from behind. */
  update(camera: Camera): void {
    this.root.updateMatrixWorld(true);
    const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const world = new Vector3();
    const n = new Vector3();
    const toCam = new Vector3();
    for (const l of this.labels) {
      world.copy(l.labelPos).applyMatrix4(this.model.matrixWorld);
      const dist = Math.max(0.05, world.distanceTo(camPos));
      const h = Math.min(0.05, Math.max(0.006, dist * LABEL_HEIGHT_PER_M));
      l.sprite.scale.set(h * (l.sprite.userData.aspect as number), h, 1);

      n.copy(l.normal).transformDirection(this.model.matrixWorld);
      toCam.copy(camPos).sub(world).normalize();
      const facing = n.dot(toCam); // 1 = facing the viewer, <0 = from behind
      const selected = l.annotation.id === this.selectedId;
      // full strength until the surface turns away (grazing views stay readable), faint from behind
      const opacity = selected ? 1 : Math.min(1, Math.max(0.12, (facing + 0.35) / 0.45));
      (l.sprite.material as { opacity: number }).opacity = opacity;
      (l.dot.material as MeshBasicMaterial).opacity = opacity;
      (l.line.material as LineBasicMaterial).opacity = opacity * 0.9;
    }
  }

  /** What did the user tap? Labels first, then the region/point under the ray. */
  pick(raycaster: Raycaster): string | null {
    const sprites = this.labels.map((l) => l.sprite);
    const hitLabel = raycaster.intersectObjects(sprites, false)[0];
    if (hitLabel) {
      return this.labels.find((l) => l.sprite === hitLabel.object)!.annotation.id;
    }
    const hit = raycaster.intersectObject(this.occluder, false)[0];
    if (!hit) return null;
    if (hit.faceIndex != null) {
      const region = this.regionOfTriangle.get(hit.faceIndex);
      if (region) return region;
    }
    const local = this.model.worldToLocal(hit.point.clone());
    let best: string | null = null;
    let bestD = PICK_POINT_RADIUS_M;
    for (const l of this.labels) {
      if (l.annotation.kind !== 'point') continue;
      const d = l.anchor.distanceTo(local);
      if (d < bestD) {
        bestD = d;
        best = l.annotation.id;
      }
    }
    return best;
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry && m.geometry !== this.geometry) m.geometry.dispose();
      const mat = (m as { material?: { dispose(): void; map?: { dispose(): void } | null } })
        .material;
      mat?.map?.dispose();
      mat?.dispose();
    });
    this.geometry.dispose();
  }

  // -------------------------------------------------------------------------

  private buildLabel(a: Annotation, number: number): LabelEntry {
    const anchor = new Vector3(...a.anchor.position);
    const normal = new Vector3(...a.anchor.normal).normalize();
    const labelPos = anchor.clone().addScaledVector(normal, LABEL_OFFSET_M);
    const group = new Group();
    group.name = `label:${a.id}`;

    const dot = new Mesh(
      new SphereGeometry(0.0025, 12, 8),
      new MeshBasicMaterial({ color: 0xffc400, transparent: true, depthWrite: false }),
    );
    dot.position.copy(anchor);
    dot.renderOrder = 2;
    const line = new Line(
      new BufferGeometry().setFromPoints([anchor, labelPos]),
      new LineBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
    );
    line.renderOrder = 2;
    const sprite = createLabelSprite(number, a.title);
    sprite.position.copy(labelPos);
    group.add(line, dot, sprite);
    this.model.add(group);
    return { annotation: a, group, sprite, dot, line, anchor, normal, labelPos };
  }

  private buildHighlight(triangles: number[]): Mesh {
    const pos = this.geometry.getAttribute('position') as BufferAttribute;
    const index = this.geometry.getIndex();
    const out = new Float32Array(triangles.length * 9);
    triangles.forEach((t, i) => {
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(t * 3 + k) : t * 3 + k;
        out[i * 9 + k * 3] = pos.getX(v);
        out[i * 9 + k * 3 + 1] = pos.getY(v);
        out[i * 9 + k * 3 + 2] = pos.getZ(v);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    const mesh = new Mesh(
      g,
      new MeshBasicMaterial({
        color: 0xffc400,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    mesh.renderOrder = 2;
    mesh.name = 'highlight';
    return mesh;
  }

  private buildDebug(): void {
    const y = 0.0008;
    const green = new LineBasicMaterial({ color: 0x00e676 });
    for (const m of this.project.mat.markers) {
      const h = mmToM(m.widthMm) / 2;
      const a = (-m.rotationDeg * Math.PI) / 180;
      const pts = [
        [-h, -h],
        [h, -h],
        [h, h],
        [-h, h],
      ].map(
        ([x, z]) =>
          new Vector3(
            mmToM(m.centerMm[0]) + x! * Math.cos(a) + z! * Math.sin(a),
            y,
            mmToM(m.centerMm[1]) - x! * Math.sin(a) + z! * Math.cos(a),
          ),
      );
      this.debug.add(new LineLoop(new BufferGeometry().setFromPoints(pts), green));
    }
    const track = this.project.mat.trackImage;
    if (track) {
      const [cx, cz] = track.centerMm;
      const hw = track.widthMm / 2;
      const hh = track.heightMm / 2;
      const pts = [
        [cx - hw, cz - hh],
        [cx + hw, cz - hh],
        [cx + hw, cz + hh],
        [cx - hw, cz + hh],
      ].map(([x, z]) => new Vector3(mmToM(x!), y, mmToM(z!)));
      this.debug.add(
        new LineLoop(
          new BufferGeometry().setFromPoints(pts),
          new LineBasicMaterial({ color: 0x00b8d4 }),
        ),
      );
    }
    const orange = new LineBasicMaterial({ color: 0xff6d00 });
    for (const ring of this.project.mat.contactOutlineMm) {
      const pts = ring.map(([x, z]) => new Vector3(mmToM(x), y, mmToM(z)));
      this.debug.add(new LineLoop(new BufferGeometry().setFromPoints(pts), orange));
    }
    // mat axes: +X red, +Y green, +Z (FRONT) blue, 5 cm
    const axes: [Vector3, number][] = [
      [new Vector3(0.05, 0, 0), 0xff1744],
      [new Vector3(0, 0.05, 0), 0x00e676],
      [new Vector3(0, 0, 0.05), 0x2979ff],
    ];
    for (const [v, color] of axes) {
      this.debug.add(
        new Line(
          new BufferGeometry().setFromPoints([new Vector3(0, y, 0), v.clone().setY(v.y + y)]),
          new LineBasicMaterial({ color }),
        ),
      );
    }
  }
}
