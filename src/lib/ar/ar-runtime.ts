import {
  AmbientLight,
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
  detectImageConvention,
  estimateWorldFromMat,
  PoseFilter,
  type ConventionScore,
  type ImageConvention,
  type MarkerObservation,
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

export interface ArStatus {
  phase: TrackingPhase;
  /** marker ids per tracking state this frame */
  tracked: string[];
  emulated: string[];
  /** 'fit' (≥3 markers, convention-free) or 'average' */
  method: 'fit' | 'average' | null;
  residualMm: number | null;
  rejected: string[];
  convention: ImageConvention;
  conventionSource: 'default' | 'detected' | 'stored' | 'override';
  conventionScores: ConventionScore[];
  trackability: readonly XRImageTrackability[] | null;
  fps: number;
}

export interface ArRuntimeOptions {
  project: ViewerProject;
  exhibit: ExhibitScene;
  /** in `project.mat.markers` order */
  markerBitmaps: ImageBitmap[];
  /** becomes the DOM overlay (UI on top of the camera view) */
  overlayRoot: HTMLElement;
  onStatus(status: ArStatus): void;
  onSelect(annotationId: string | null): void;
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
  private conventionScores: ConventionScore[] = [];
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
    const trackedImages: XRTrackedImageInit[] = this.o.project.mat.markers.map((m, i) => ({
      image: this.o.markerBitmaps[i]!,
      widthInMeters: m.widthMm / 1000,
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
    this.emitStatus('starting', [], [], null, true);
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
        const marker = this.o.project.mat.markers[r.index];
        const pose = marker && frame.getPose(r.imageSpace, ref);
        if (!marker || !pose || r.trackingState === 'untracked') continue;
        observations.push({
          markerId: marker.id,
          worldFromImage: new Matrix4().fromArray(pose.transform.matrix),
          state: r.trackingState,
        });
        (r.trackingState === 'tracked' ? tracked : emulated).push(marker.id);
      }
    }

    const fused = estimateWorldFromMat(observations, this.o.project.mat.markers, this.convention);
    let phase: TrackingPhase;
    if (fused && tracked.length > 0) {
      if (fused.method === 'fit' && tracked.length >= 3)
        this.voteConvention(observations, fused.worldFromMat);
      this.o.exhibit.root.matrix.copy(this.filter.update(fused.worldFromMat, dt));
      this.o.exhibit.root.visible = true;
      phase = 'tracking';
    } else if (this.filter.current) {
      // Markers out of view: world tracking keeps the last pose anchored.
      phase = 'holding';
    } else {
      phase = 'searching';
    }

    const xrCamera = renderer.xr.getCamera();
    this.o.exhibit.update(xrCamera);
    renderer.render(this.scene, this.camera);
    this.emitStatus(phase, tracked, emulated, fused);
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

  /** Measure the tracker's axis convention on this device; lock it after consistent evidence. */
  private voteConvention(obs: MarkerObservation[], worldFromMat: Matrix4): void {
    this.conventionScores = detectImageConvention(obs, this.o.project.mat.markers, worldFromMat);
    if (this.conventionSource === 'override' || this.conventionSource === 'detected') return;
    const [best, second] = this.conventionScores;
    if (
      !best ||
      !second ||
      best.meanErrorDeg > 20 ||
      second.meanErrorDeg - best.meanErrorDeg < 30
    ) {
      return;
    }
    const votes = (this.conventionVotes.get(best.convention) ?? 0) + 1;
    this.conventionVotes.set(best.convention, votes);
    if (votes >= CONVENTION_FRAMES_TO_LOCK) {
      this.convention = best.convention;
      this.conventionSource = 'detected';
      try {
        localStorage.setItem(CONVENTION_STORAGE_KEY, best.convention);
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
    force = false,
  ): void {
    const now = performance.now();
    if (!force && now - this.lastStatus < STATUS_INTERVAL_MS) return;
    this.lastStatus = now;
    this.o.onStatus({
      phase,
      tracked,
      emulated,
      method: fused?.method ?? null,
      residualMm: fused?.residualM != null ? fused.residualM * 1000 : null,
      rejected: fused?.rejected ?? [],
      convention: this.convention,
      conventionSource: this.conventionSource,
      conventionScores: this.conventionScores,
      trackability: this.trackability,
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
