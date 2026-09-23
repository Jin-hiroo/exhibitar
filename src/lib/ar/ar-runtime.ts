import {
  AmbientLight,
  type ArrayCamera,
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ViewerProject } from '../types';
import type { ExhibitScene } from './exhibit-scene';
import {
  DEFAULT_IMAGE_CONVENTION,
  estimateWorldFromMat,
  PoseFilter,
  printScales,
  trackTargets,
  type ImageConvention,
  type MarkerObservation,
  type TrackTarget,
} from './pose';
import {
  getImageTrackability,
  getImageTrackingResults,
  IMAGE_TRACKING_FEATURES,
  imageTrackingEnabled,
  type XRImageTrackability,
  type XRTrackedImageInit,
} from './xr-image-tracking';

export type TrackingPhase = 'starting' | 'searching' | 'tracking' | 'holding';

export interface OffscreenGuide {
  /** arrow position as fractions of the screen (0,0 = top-left) */
  x: number;
  y: number;
  /** direction to the target, degrees clockwise from "right" */
  angleDeg: number;
}

export interface ArStatus {
  phase: TrackingPhase;
  /** tracking target ids in `trackedImages` order (markers, then 'mat' if used) */
  targets: string[];
  /** target ids per tracking state this frame */
  tracked: string[];
  emulated: string[];
  /** RMS fit error of image corners/centres, mm */
  residualMm: number | null;
  /** fit error per tracker axis convention this frame, mm (the loser is typically ≫) */
  residualByConventionMm: Record<ImageConvention, number> | null;
  rejected: string[];
  /** convention used for this frame's fit, and why */
  frameConvention: ImageConvention | null;
  decidedBy: string | null;
  /** remembered preference and where it came from */
  convention: ImageConvention;
  conventionSource: 'default' | 'detected' | 'stored' | 'override';
  trackability: readonly XRImageTrackability[] | null;
  /** measured / expected image width (≈ 1 when printed at 100 %), median over tracked images */
  printScale: number | null;
  fps: number;
}

export interface ArRuntimeOptions {
  project: ViewerProject;
  exhibit: ExhibitScene;
  /** in `project.mat.markers` order */
  markerBitmaps: ImageBitmap[];
  /** the whole-mat tracking image, if the project has one; null disables it */
  matBitmap: ImageBitmap | null;
  /** becomes the DOM overlay (UI on top of the camera view) */
  overlayRoot: HTMLElement;
  onStatus(status: ArStatus): void;
  onSelect(annotationId: string | null): void;
  /**
   * Every frame while an annotation is selected: where to point an edge arrow
   * when it is off-screen (screen fractions 0..1 and a clockwise angle), else null.
   */
  onGuide?(guide: OffscreenGuide | null): void;
  onEnd(): void;
  /** force a tracker axis convention (debug: ?convention=arcore) */
  conventionOverride?: ImageConvention;
}

const CONVENTION_STORAGE_KEY = 'exhibitar.imageConvention';
const CONVENTION_FRAMES_TO_LOCK = 20;
const STATUS_INTERVAL_MS = 200;

/**
 * Plain three.js + WebXR immersive-ar runtime (ARCHITECTURE.md §5).
 * Tracking uses only the printed mat markers (CLAUDE.md core idea #1).
 */
export class ArRuntime {
  private renderer: WebGLRenderer | null = null;
  private session: XRSession | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(60, 1, 0.01, 20);
  private readonly filter = new PoseFilter();
  private convention: ImageConvention;
  private conventionSource: ArStatus['conventionSource'];
  private conventionVotes = new Map<ImageConvention, number>();
  private readonly targets: TrackTarget[];
  private trackability: readonly XRImageTrackability[] | null = null;
  private lastTime = 0;
  private lastStatus = 0;
  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private lastFrame: XRFrame | null = null;

  constructor(private readonly o: ArRuntimeOptions) {
    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 1.2));
    this.scene.add(new AmbientLight(0xffffff, 0.3));
    const sun = new DirectionalLight(0xffffff, 1.2);
    sun.position.set(0.3, 1, 0.5);
    this.scene.add(sun);
    this.scene.add(o.exhibit.root);
    o.exhibit.root.visible = false;
    this.targets = trackTargets(o.project.mat, { includeMatImage: !!o.matBitmap });

    const stored = readStoredConvention();
    if (o.conventionOverride) {
      this.convention = o.conventionOverride;
      this.conventionSource = 'override';
    } else if (stored) {
      this.convention = stored;
      this.conventionSource = 'stored';
    } else {
      this.convention = DEFAULT_IMAGE_CONVENTION;
      this.conventionSource = 'default';
    }
  }

  /** Must be called from a user gesture (tap on "Start AR"). */
  async start(): Promise<void> {
    const xr = navigator.xr;
    if (!xr) throw new Error('WebXR is not available in this browser.');
    const bitmaps = [...this.o.markerBitmaps, ...(this.o.matBitmap ? [this.o.matBitmap] : [])];
    const trackedImages: XRTrackedImageInit[] = this.targets.map((t, i) => ({
      image: bitmaps[i]!,
      widthInMeters: t.widthMm / 1000,
    }));
    const init = {
      requiredFeatures: [] as string[],
      optionalFeatures: [...IMAGE_TRACKING_FEATURES, 'dom-overlay'],
      domOverlay: { root: this.o.overlayRoot },
      trackedImages,
    } as XRSessionInit;
    const session = await xr.requestSession('immersive-ar', init);
    this.session = session;
    if (!imageTrackingEnabled(session)) {
      await session.end().catch(() => {});
      throw new Error(
        'Image tracking is not enabled. In Chrome on Android open chrome://flags, enable "WebXR Incubations", restart Chrome and try again.',
      );
    }

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    this.renderer = renderer;
    await renderer.xr.setSession(session);

    session.addEventListener('select', this.onSelect);
    session.addEventListener('end', this.onEnd);
    // UI taps on the overlay must not also count as taps into the scene
    this.o.overlayRoot.addEventListener('beforexrselect', preventXrSelectOnUi);

    getImageTrackability(session)
      .then((t) => (this.trackability = t))
      .catch(() => (this.trackability = null));
    this.emitStatus('starting', [], [], null, [], true);
    renderer.setAnimationLoop(this.onFrame);
  }

  async stop(): Promise<void> {
    await this.session?.end().catch(() => {});
  }

  setGhost(visible: boolean): void {
    this.o.exhibit.setGhost(visible);
  }

  setDebug(visible: boolean): void {
    this.o.exhibit.setDebug(visible);
  }

  // -------------------------------------------------------------------------

  private readonly onFrame = (time: number, frame?: XRFrame) => {
    const renderer = this.renderer;
    if (!renderer || !frame) return;
    this.lastFrame = frame;
    const dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;
    this.countFps(time);

    const ref = renderer.xr.getReferenceSpace();
    const observations: MarkerObservation[] = [];
    const tracked: string[] = [];
    const emulated: string[] = [];
    if (ref) {
      for (const r of getImageTrackingResults(frame)) {
        const target = this.targets[r.index];
        const pose = target && frame.getPose(r.imageSpace, ref);
        if (!target || !pose || r.trackingState === 'untracked') continue;
        observations.push({
          markerId: target.id,
          worldFromImage: new Matrix4().fromArray(pose.transform.matrix),
          state: r.trackingState,
          measuredWidthM: r.measuredWidthInMeters,
        });
        (r.trackingState === 'tracked' ? tracked : emulated).push(target.id);
      }
    }

    // Emulated images are ARCore's last known poses, which it keeps anchored as its
    // world map is corrected, so they are followed too (a frozen copy would drift).
    const fused = estimateWorldFromMat(observations, this.targets, this.convention);
    let phase: TrackingPhase;
    if (fused) {
      if (tracked.length > 0) this.voteConvention(fused);
      this.o.exhibit.root.matrix.copy(this.filter.update(fused.worldFromMat, dt));
      this.o.exhibit.root.visible = true;
      phase = tracked.length > 0 ? 'tracking' : 'holding';
    } else if (this.filter.current) {
      phase = 'holding';
    } else {
      phase = 'searching';
    }

    const xrCamera = renderer.xr.getCamera();
    this.o.exhibit.update(xrCamera);
    this.o.onGuide?.(this.guideTo(xrCamera));
    renderer.render(this.scene, this.camera);
    this.emitStatus(phase, tracked, emulated, fused, observations);
  };

  private readonly onSelect = (ev: XRInputSourceEvent) => {
    const renderer = this.renderer;
    const ref = renderer?.xr.getReferenceSpace();
    if (!renderer || !ref) return;
    const pose = (ev.frame ?? this.lastFrame)?.getPose(ev.inputSource.targetRaySpace, ref);
    if (!pose) return;
    const m = new Matrix4().fromArray(pose.transform.matrix);
    const origin = new Vector3().setFromMatrixPosition(m);
    const dir = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().setFromRotationMatrix(m));
    const ray = new Raycaster(origin, dir.normalize(), 0.01, 10);
    ray.camera = renderer.xr.getCamera();
    const id = this.o.exhibit.pick(ray);
    this.o.exhibit.select(id);
    this.o.onSelect(id);
  };

  private readonly onEnd = () => {
    this.renderer?.setAnimationLoop(null);
    this.o.overlayRoot.removeEventListener('beforexrselect', preventXrSelectOnUi);
    this.scene.remove(this.o.exhibit.root);
    this.renderer?.dispose();
    this.renderer = null;
    this.session = null;
    this.o.onEnd();
  };

  /** Edge arrow toward the selected annotation when it is outside the view. */
  private guideTo(xrCamera: ArrayCamera): OffscreenGuide | null {
    const id = this.o.exhibit.selected;
    if (!id || !this.o.exhibit.root.visible) return null;
    const world = this.o.exhibit.labelWorldPosition(id);
    const cam = xrCamera.cameras[0] ?? xrCamera;
    if (!world) return null;
    const ndc = world.clone().project(cam);
    const camPos = new Vector3().setFromMatrixPosition(cam.matrixWorld);
    const behind =
      new Vector3().subVectors(world, camPos).dot(cam.getWorldDirection(new Vector3())) < 0;
    let { x, y } = ndc;
    if (behind) {
      x = -x;
      y = -y;
    }
    if (!behind && Math.abs(x) <= 0.95 && Math.abs(y) <= 0.95) return null;
    const angle = Math.atan2(y, x);
    const k = 0.85 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
    return {
      x: 0.5 + 0.5 * Math.cos(angle) * k,
      y: 0.5 - 0.5 * Math.sin(angle) * k,
      angleDeg: (-angle * 180) / Math.PI,
    };
  }

  /**
   * The fit tries both tracker axis conventions every frame; remember the one
   * that wins clearly and consistently (Task D0 answer for this device).
   */
  private voteConvention(fused: NonNullable<ReturnType<typeof estimateWorldFromMat>>): void {
    if (this.conventionSource === 'override' || this.conventionSource === 'detected') return;
    // only frames that could actually tell (several images, or a clear residual gap)
    if (fused.decidedBy !== 'inliers' && fused.decidedBy !== 'residual') return;
    const winner = fused.convention;
    const votes = (this.conventionVotes.get(winner) ?? 0) + 1;
    this.conventionVotes.set(winner, votes);
    if (votes >= CONVENTION_FRAMES_TO_LOCK) {
      this.convention = winner;
      this.conventionSource = 'detected';
      try {
        localStorage.setItem(CONVENTION_STORAGE_KEY, winner);
      } catch {
        // storage unavailable (private mode): detection simply repeats next time
      }
    }
  }

  private countFps(time: number): void {
    this.frames++;
    if (!this.fpsWindowStart) this.fpsWindowStart = time;
    if (time - this.fpsWindowStart >= 1000) {
      this.fps = (this.frames * 1000) / (time - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = time;
    }
  }

  private emitStatus(
    phase: TrackingPhase,
    tracked: string[],
    emulated: string[],
    fused: ReturnType<typeof estimateWorldFromMat>,
    observations: MarkerObservation[] = [],
    force = false,
  ): void {
    const now = performance.now();
    if (!force && now - this.lastStatus < STATUS_INTERVAL_MS) return;
    this.lastStatus = now;
    this.o.onStatus({
      phase,
      targets: this.targets.map((t) => t.id),
      tracked,
      emulated,
      residualMm: fused ? fused.residualM * 1000 : null,
      residualByConventionMm: fused
        ? {
            spec: fused.residualByConvention.spec * 1000,
            arcore: fused.residualByConvention.arcore * 1000,
          }
        : null,
      rejected: fused?.rejected ?? [],
      frameConvention: fused?.convention ?? null,
      decidedBy: fused?.decidedBy ?? null,
      convention: this.convention,
      conventionSource: this.conventionSource,
      trackability: this.trackability,
      printScale: median(printScales(observations, this.targets).map((p) => p.scale)),
      fps: this.fps,
    });
  }
}

function preventXrSelectOnUi(ev: Event): void {
  const target = ev.target as HTMLElement | null;
  if (target?.closest('[data-ui]')) ev.preventDefault();
}

function readStoredConvention(): ImageConvention | null {
  try {
    const v = localStorage.getItem(CONVENTION_STORAGE_KEY);
    return v === 'spec' || v === 'arcore' ? v : null;
  } catch {
    return null;
  }
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
