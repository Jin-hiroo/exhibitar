import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ViewerProject } from '../types';
import { mmToM } from '../units';
import type { ExhibitScene } from './exhibit-scene';

export interface OrbitViewerOptions {
  container: HTMLElement;
  project: ViewerProject;
  exhibit: ExhibitScene;
  markerUrls: string[];
  onSelect(annotationId: string | null): void;
}

/**
 * Fallback when AR is unavailable (SPEC §4.8): the same exhibit scene on a
 * virtual mat, orbitable, with the model visible and the same labels.
 */
export class OrbitViewer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.005, 20);
  private readonly controls: OrbitControls;
  private readonly resize: ResizeObserver;
  private downAt: Vector2 | null = null;

  constructor(private readonly o: OrbitViewerOptions) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setClearColor(new Color(0xeef0f3));
    o.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';

    this.scene.add(new HemisphereLight(0xffffff, 0x8899aa, 1.4));
    this.scene.add(new AmbientLight(0xffffff, 0.2));
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.3, 1, 0.6);
    this.scene.add(sun);

    this.scene.add(o.exhibit.root);
    o.exhibit.root.matrix.identity();
    o.exhibit.root.visible = true;
    o.exhibit.setGhost(true, 1);
    this.scene.add(buildVirtualMat(o.project, o.markerUrls));

    // look at the object from the FRONT, slightly above
    const size = o.project.model.boundsMm.size.map(mmToM);
    const radius = Math.max(0.08, Math.hypot(...size));
    const target = new Vector3(0, mmToM(o.project.model.boundsMm.size[1]) / 2, 0);
    this.camera.position.set(radius * 0.6, radius * 1.1, radius * 1.9);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = radius * 0.4;
    this.controls.maxDistance = radius * 6;

    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(o.container);
    this.onResize();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    this.renderer.setAnimationLoop(this.onFrame);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.controls.dispose();
    this.scene.remove(this.o.exhibit.root);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly onFrame = () => {
    this.controls.update();
    this.o.exhibit.update(this.camera);
    this.renderer.render(this.scene, this.camera);
  };

  private onResize(): void {
    const { clientWidth: w, clientHeight: h } = this.o.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.downAt = new Vector2(e.clientX, e.clientY);
  };

  /** A tap (not a drag) selects the label / region / point under the pointer. */
  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.downAt || this.downAt.distanceTo(new Vector2(e.clientX, e.clientY)) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const id = this.o.exhibit.pick(ray);
    this.o.exhibit.select(id);
    this.o.onSelect(id);
  };
}

/** The printed mat, rebuilt from project data: paper, markers, outlines (mat frame, metres). */
function buildVirtualMat(project: ViewerProject, markerUrls: string[]): Group {
  const g = new Group();
  g.name = 'virtual-mat';
  const pts: [number, number][] = [
    ...project.mat.shadowOutlineMm.flat(),
    ...project.mat.markers.flatMap((m) => [
      [m.centerMm[0] - m.widthMm / 2, m.centerMm[1] - m.widthMm / 2] as [number, number],
      [m.centerMm[0] + m.widthMm / 2, m.centerMm[1] + m.widthMm / 2] as [number, number],
    ]),
  ];
  const margin = 15;
  const minX = Math.min(...pts.map((p) => p[0])) - margin;
  const maxX = Math.max(...pts.map((p) => p[0])) + margin;
  const minZ = Math.min(...pts.map((p) => p[1])) - margin;
  const maxZ = Math.max(...pts.map((p) => p[1])) + margin;

  const paper = new Mesh(
    new PlaneGeometry(mmToM(maxX - minX), mmToM(maxZ - minZ)).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0xffffff }),
  );
  paper.position.set(mmToM((minX + maxX) / 2), -0.0005, mmToM((minZ + maxZ) / 2));
  g.add(paper);

  const loader = new TextureLoader();
  project.mat.markers.forEach((m, i) => {
    const url = markerUrls[i];
    if (!url) return;
    const tex = loader.load(url);
    tex.colorSpace = SRGBColorSpace;
    // plane +Y (image top) → −Z after rotateX(−90°): page up, as printed
    const quad = new Mesh(
      new PlaneGeometry(mmToM(m.widthMm), mmToM(m.widthMm)).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: tex }),
    );
    quad.rotation.y = (-m.rotationDeg * Math.PI) / 180;
    quad.position.set(mmToM(m.centerMm[0]), 0, mmToM(m.centerMm[1]));
    g.add(quad);
  });

  const y = 0.0004;
  for (const ring of project.mat.shadowOutlineMm) {
    const line = new LineLoop(
      new BufferGeometry().setFromPoints(ring.map(([x, z]) => new Vector3(mmToM(x), y, mmToM(z)))),
      new LineDashedMaterial({ color: 0x333333, dashSize: 0.003, gapSize: 0.002 }),
    );
    line.computeLineDistances();
    g.add(line);
  }
  for (const ring of project.mat.contactOutlineMm) {
    g.add(
      new LineLoop(
        new BufferGeometry().setFromPoints(
          ring.map(([x, z]) => new Vector3(mmToM(x), y, mmToM(z))),
        ),
        new LineBasicMaterial({ color: 0x000000 }),
      ),
    );
  }
  // FRONT arrow on the +Z side
  const fz = mmToM(maxZ - margin / 2);
  g.add(
    new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(-0.01, y, fz - 0.008),
        new Vector3(0, y, fz),
        new Vector3(0.01, y, fz - 0.008),
      ]),
      new LineBasicMaterial({ color: 0x000000 }),
    ),
  );
  return g;
}
