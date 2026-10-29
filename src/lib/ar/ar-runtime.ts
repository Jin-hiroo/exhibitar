import {
  createBoard,
  createTracker,
  DEFAULT_FAMILY,
  type Board,
  type CameraExposure,
  type IntrinsicsEvent,
  type PoseEvent,
  type StateEvent,
  type Tracker,
  type TrackerErrorEvent,
} from 'matar';
import { MatarThree } from 'matar/three';
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { ViewerProject } from '../types';
import type { ExhibitScene } from './exhibit-scene';
import { findSavedCamera, saveIntrinsics } from './saved-intrinsics';

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
  /** tags on the mat */
  tagsTotal: number;
  /** tags found / used for the pose in the newest analysed frame */
  tagsFound: number;
  tagsUsed: number;
  /** RMS reprojection error of the newest pose, px */
  errPx: number | null;
  /** analysed frames per second */
  fps: number;
  /** focal length in use, px, and where it came from */
  focalPx: number | null;
  focalSource: 'prior' | 'provided' | 'estimated' | null;
  /** camera label (empty until known) and where tracking runs */
  camera: string;
  worker: 'module' | 'inline' | null;
  /** what became of the exposure cap (`MAX_EXPOSURE_MS`); null before the first frame */
  exposure: CameraExposure | null;
}

export interface ArRuntimeOptions {
  project: ViewerProject;
  exhibit: ExhibitScene;
  /** the camera view (a canvas filling the screen) goes in here, under the UI */
  container: HTMLElement;
  onStatus(status: ArStatus): void;
  onSelect(annotationId: string | null): void;
  /**
   * Every frame while an annotation is selected: where to point an edge arrow
   * when it is off-screen (screen fractions 0..1 and a clockwise angle), else null.
   */
  onGuide?(guide: OffscreenGuide | null): void;
  /** AR ended after it started: `stop()`, or the camera failed (`error` says how) */
  onEnd(error?: string): void;
}

const STATUS_INTERVAL_MS = 200;
/**
 * Longest camera exposure, ms (matar's `camera.maxExposureMs`): against motion
 * blur. Indoors, Android picks about 10 ms or more by itself, which smears the
 * tags when the phone moves. Android Chrome only; nothing changes on iOS.
 * The matar demo ran with 4 ms (`?exposure=4`) in the device tests.
 */
const MAX_EXPOSURE_MS = 4;
/** a tap that moved further than this is a drag, not a selection, CSS px */
const TAP_SLOP_PX = 10;

/**
 * The AR viewer on matar (docs/MATAR-MIGRATION.md M3, ARCHITECTURE.md §5):
 * the phone camera in the page, the printed tags tracked in a worker, three.js
 * drawn over the analysed frame. No WebXR, no flags, the same on iPhone and
 * Android.
 *
 * Mat frame = world: matar's board frame is the mat frame (origin at the
 * footprint centre, Y up, metres in three.js), so `exhibit.root` stays at the
 * identity and `MatarThree` moves the camera. Tracking uses only the printed
 * mat (CLAUDE.md core idea 1). Camera frames never leave the phone.
 *
 * The focal length matar measures is saved per camera and reused on the next
 * visit (saved-intrinsics.ts), so the self-calibration isn't redone each time.
 */
export class ArRuntime {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.01, 20);
  private readonly board: Board;
  private tracker: Tracker | null = null;
  private renderer: WebGLRenderer | null = null;
  private ar: MatarThree | null = null;
  private last: PoseEvent | null = null;
  private lastError: TrackerErrorEvent | null = null;
  private lastStatus = 0;
  /** pointers down on the view, and the one that may become a tap (only while it is alone) */
  private readonly pointers = new Set<number>();
  private tap: { x: number; y: number; id: number } | null = null;
  /** `start()` has resolved: later camera failures end AR through `onEnd` */
  private running = false;
  private ended = false;

  /** Throws if the mat has no tags (made for the old WebXR viewer, design ≤ 2). */
  constructor(private readonly o: ArRuntimeOptions) {
    const tags = o.project.mat.tags;
    if (!tags?.length) throw new Error(OLD_MAT_TEXT);
    this.board = createBoard({ family: o.project.mat.tagFamily ?? DEFAULT_FAMILY, tags });
    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 1.2));
    this.scene.add(new AmbientLight(0xffffff, 0.3));
    const sun = new DirectionalLight(0xffffff, 1.2);
    sun.position.set(0.3, 1, 0.5);
    this.scene.add(sun);
    this.scene.add(o.exhibit.root);
    o.exhibit.root.visible = false;
  }

  /**
   * Opens the camera and starts tracking. Call from a user gesture (the tap on
   * "Start AR"): browsers only show the camera prompt then. Rejects if the
   * camera can't be opened (`cameraErrorText` explains why); no `onEnd` then.
   */
  async start(): Promise<void> {
    // pick up where a previous visit's self-calibration left off, on the same camera
    const saved = await findSavedCamera();
    if (this.ended) return; // stopped meanwhile
    try {
      const tracker = createTracker({
        board: this.board,
        camera: {
          maxExposureMs: MAX_EXPOSURE_MS,
          ...(saved ? { deviceId: saved.deviceId } : {}),
        },
        ...(saved ? { intrinsics: saved.intrinsics } : {}),
      });
      this.tracker = tracker;
      tracker.addEventListener('pose', this.onPose);
      tracker.addEventListener('intrinsics', this.onIntrinsics);
      tracker.addEventListener('error', this.onError);
      tracker.addEventListener('state', this.onState);
      const renderer = new WebGLRenderer({ antialias: true });
      this.renderer = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      const canvas = renderer.domElement;
      canvas.addEventListener('pointerdown', this.onPointerDown);
      canvas.addEventListener('pointerup', this.onPointerUp);
      canvas.addEventListener('pointercancel', this.onPointerCancel);
      this.o.container.appendChild(canvas);
      window.addEventListener('resize', this.onResize);
      this.ar = new MatarThree({ tracker, renderer, camera: this.camera, scene: this.scene });
      this.emitStatus(true);
      await tracker.start();
    } catch (e) {
      if (this.ended) return; // stopped meanwhile: not a failure to report
      this.teardown();
      throw e;
    }
    if (this.ended) return; // stopped while the camera opened
    this.running = true;
    this.renderer?.setAnimationLoop(this.onFrame);
  }

  /** Stops the camera and tears the view down; `onEnd` follows. */
  stop(): void {
    if (this.ended) return;
    this.teardown();
    this.o.onEnd();
  }

  setGhost(visible: boolean): void {
    this.o.exhibit.setGhost(visible);
  }

  setDebug(visible: boolean): void {
    this.o.exhibit.setDebug(visible);
  }

  // -------------------------------------------------------------------------

  private readonly onFrame = () => {
    const renderer = this.renderer;
    const ar = this.ar;
    if (!renderer || !ar) return;
    const { tracking } = ar.update();
    this.o.exhibit.root.visible = tracking;
    this.o.exhibit.update(this.camera);
    this.o.onGuide?.(this.guideTo());
    renderer.render(this.scene, this.camera);
  };

  private readonly onPose = (e: PoseEvent) => {
    this.last = e;
    this.emitStatus();
  };

  /** A focal length the tracker measured: saved for this camera's next visit. */
  private readonly onIntrinsics = (e: IntrinsicsEvent) => {
    if (e.source !== 'estimated') return;
    const stream = this.tracker?.video.srcObject as MediaStream | null | undefined;
    const label = stream?.getVideoTracks()[0]?.label;
    if (label) saveIntrinsics({ label, intrinsics: e.intrinsics });
  };

  private readonly onError = (e: TrackerErrorEvent) => {
    this.lastError = e;
  };

  /** The camera failed after AR started (e.g. it couldn't be reopened after the phone slept). */
  private readonly onState = (e: StateEvent) => {
    if (e.state !== 'error' || !this.running || this.ended) return;
    this.teardown();
    this.o.onEnd(cameraErrorText(this.lastError));
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    this.pointers.add(e.pointerId);
    // a second finger turns the gesture into something other than a tap
    this.tap = this.pointers.size === 1 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  };

  /**
   * A tap on the view (the UI sits above it and takes its own taps): one
   * finger, lifted near where it went down. Selects the label or region under it.
   */
  private readonly onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const t = this.tap;
    if (!t || t.id !== e.pointerId) return;
    this.tap = null;
    const ar = this.ar;
    if (!ar || Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP_PX) return;
    if (!this.o.exhibit.root.visible) return;
    const id = this.o.exhibit.pick(ar.raycaster(e));
    this.o.exhibit.select(id);
    this.o.onSelect(id);
  };

  private readonly onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.tap = null;
  };

  private readonly onResize = () => {
    this.renderer?.setSize(window.innerWidth, window.innerHeight);
  };

  private teardown(): void {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const t = this.tracker;
    if (t) {
      t.removeEventListener('pose', this.onPose);
      t.removeEventListener('intrinsics', this.onIntrinsics);
      t.removeEventListener('error', this.onError);
      t.removeEventListener('state', this.onState);
      t.stop();
    }
    window.removeEventListener('resize', this.onResize);
    const renderer = this.renderer;
    renderer?.setAnimationLoop(null);
    // the camera textures first: they are freed through the renderer
    this.ar?.dispose();
    this.ar = null;
    if (renderer) {
      const canvas = renderer.domElement;
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerCancel);
      canvas.remove();
      renderer.dispose();
      // browsers allow few live WebGL contexts: don't wait for garbage collection
      renderer.forceContextLoss();
    }
    this.renderer = null;
    this.pointers.clear();
    this.tap = null;
    this.scene.remove(this.o.exhibit.root);
  }

  /** Edge arrow toward the selected annotation when it is outside the view. */
  private guideTo(): OffscreenGuide | null {
    const id = this.o.exhibit.selected;
    if (!id || !this.o.exhibit.root.visible) return null;
    const world = this.o.exhibit.labelWorldPosition(id);
    if (!world) return null;
    const cam = this.camera;
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

  private emitStatus(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastStatus < STATUS_INTERVAL_MS) return;
    this.lastStatus = now;
    const e = this.last;
    const phase: TrackingPhase = !e
      ? 'starting'
      : e.pose
        ? 'tracking'
        : e.smoothed
          ? 'holding'
          : 'searching';
    this.o.onStatus({
      phase,
      tagsTotal: this.board.tags.length,
      tagsFound: e?.detections.length ?? 0,
      tagsUsed: e?.pose?.usedTagIds.length ?? 0,
      errPx: e?.pose?.rmsErrPx ?? null,
      fps: e?.stats.fps ?? 0,
      focalPx: e?.stats.focal.fx ?? null,
      focalSource: e?.stats.focal.source ?? null,
      camera: e?.stats.camera.label ?? '',
      worker: e?.stats.worker ?? null,
      exposure: e?.stats.camera.exposure ?? null,
    });
  }
}

const OLD_MAT_TEXT =
  'This exhibit’s mat was made for the old viewer. The exhibitor needs to rebuild and reprint it in the Studio.';

/** What to tell the visitor when the camera can't be used (a matar error or its `code`). */
export function cameraErrorText(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  switch (code) {
    case 'permission-denied':
      return 'Camera access is blocked. Allow the camera for this site in your browser settings, then tap Start AR again.';
    case 'no-camera':
      return 'No camera was found on this device.';
    case 'camera-in-use':
      return 'The camera is in use by another app or tab. Close it and tap Start AR again.';
    case 'insecure-context':
      return 'AR needs a secure connection (https://).';
    case 'no-camera-api':
      return 'This browser can’t open the camera. Open the page in Safari on iPhone or Chrome on Android.';
    case 'overconstrained':
      return 'The camera doesn’t offer a usable video size.';
    default: {
      const msg = e instanceof Error ? e.message : (e as { message?: unknown } | null)?.message;
      return `AR couldn’t start${typeof msg === 'string' && msg ? `: ${msg}` : '.'}`;
    }
  }
}
