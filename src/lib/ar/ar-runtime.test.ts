import { Group } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mock from '../../../tests/fixtures/project.mock.json';
import type { ViewerProject } from '../types';
import type { ExhibitScene } from './exhibit-scene';

/**
 * ArRuntime's lifecycle with matar's tracker, MatarThree and the WebGL
 * renderer replaced by fakes that log what happens (no camera, GPU or DOM in
 * Node). The real ones run in the e2e test (tests/e2e/viewer-ar.spec.ts).
 */

const log: string[] = [];

/** a promise with its resolve/reject outside */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const h = vi.hoisted(() => ({
  trackerStart: null as null | (() => Promise<void>),
  savedCamera: null as null | (() => Promise<unknown>),
  matarThreeThrows: false,
  trackers: [] as EventTarget[],
}));

vi.mock('matar', async (orig) => ({
  ...(await orig<typeof import('matar')>()),
  createTracker: vi.fn((opts: unknown) => {
    const t = Object.assign(new EventTarget(), {
      opts,
      video: { srcObject: null },
      start: () => {
        log.push('tracker.start');
        return h.trackerStart ? h.trackerStart() : Promise.resolve();
      },
      stop: () => log.push('tracker.stop'),
    });
    h.trackers.push(t);
    return t;
  }),
}));

vi.mock('matar/three', () => ({
  MatarThree: class {
    constructor() {
      if (h.matarThreeThrows) throw new Error('no WebGL');
      log.push('ar.new');
    }
    update() {
      return { tracking: true, frameId: 1 };
    }
    raycaster() {
      return 'ray';
    }
    dispose() {
      log.push('ar.dispose');
    }
  },
}));

vi.mock('three', async (orig) => ({
  ...(await orig<typeof import('three')>()),
  WebGLRenderer: class {
    domElement = Object.assign(new EventTarget(), { remove: () => log.push('canvas.remove') });
    setPixelRatio() {}
    setSize() {}
    render() {}
    setAnimationLoop(f: unknown) {
      log.push(f ? 'loop.on' : 'loop.off');
    }
    dispose() {
      log.push('renderer.dispose');
    }
    forceContextLoss() {
      log.push('renderer.forceContextLoss');
    }
  },
}));

vi.mock('./saved-intrinsics', () => ({
  findSavedCamera: () => (h.savedCamera ? h.savedCamera() : Promise.resolve(null)),
  saveIntrinsics: () => {},
}));

const { ArRuntime } = await import('./ar-runtime');

function fakeExhibit() {
  return {
    root: new Group(),
    selected: null,
    setGhost: () => {},
    setDebug: () => {},
    update: () => false,
    pick: () => 'a1',
    select: (id: string | null) => log.push(`select ${id}`),
    labelWorldPosition: () => null,
  } as unknown as ExhibitScene;
}

function setup(project: ViewerProject = mock as unknown as ViewerProject) {
  const ends: (string | undefined)[] = [];
  const selects: (string | null)[] = [];
  const runtime = new ArRuntime({
    project,
    exhibit: fakeExhibit(),
    container: { appendChild: () => log.push('canvas.append') } as unknown as HTMLElement,
    onStatus: () => {},
    onSelect: (id) => selects.push(id),
    onEnd: (err) => ends.push(err),
  });
  return { runtime, ends, selects };
}

/** a pointer event on the view */
function pointer(type: string, id: number, x = 100, y = 100): Event {
  return Object.assign(new Event(type), { pointerId: id, clientX: x, clientY: y });
}

beforeEach(() => {
  log.length = 0;
  h.trackerStart = null;
  h.savedCamera = null;
  h.matarThreeThrows = false;
  h.trackers.length = 0;
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), { devicePixelRatio: 2, innerWidth: 400, innerHeight: 800 }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('ArRuntime', () => {
  it('refuses a mat without tags (made for the WebXR viewer)', () => {
    const legacy = { ...mock, mat: { ...mock.mat, tags: undefined } } as unknown as ViewerProject;
    expect(() => setup(legacy)).toThrow(/old viewer/);
  });

  it('starts, then stops once: camera textures freed before the renderer, context released', async () => {
    const { runtime, ends } = setup();
    await runtime.start();
    expect(log).toEqual(['canvas.append', 'ar.new', 'tracker.start', 'loop.on']);
    runtime.stop();
    runtime.stop();
    expect(ends).toEqual([undefined]);
    expect(log.slice(4)).toEqual([
      'tracker.stop',
      'loop.off',
      'ar.dispose',
      'canvas.remove',
      'renderer.dispose',
      'renderer.forceContextLoss',
    ]);
  });

  it('asks for a short exposure, with or without a saved camera', async () => {
    await setup().runtime.start();
    const intrinsics = { fx: 1100 };
    h.savedCamera = () => Promise.resolve({ label: 'back', intrinsics, deviceId: 'cam-1' });
    await setup().runtime.start();
    const opts = h.trackers.map((t) => (t as unknown as { opts: Record<string, unknown> }).opts);
    expect(opts[0]).toMatchObject({ camera: { maxExposureMs: 4 } });
    expect(opts[0]).not.toHaveProperty('intrinsics');
    expect(opts[1]).toMatchObject({ camera: { maxExposureMs: 4, deviceId: 'cam-1' }, intrinsics });
  });

  it('stopped while looking for the saved camera: nothing is opened', async () => {
    const saved = deferred<null>();
    h.savedCamera = () => saved.promise;
    const { runtime, ends } = setup();
    const started = runtime.start();
    runtime.stop();
    saved.resolve(null);
    await started;
    expect(h.trackers).toHaveLength(0);
    expect(log).toEqual([]);
    expect(ends).toEqual([undefined]);
  });

  it('stopped while the camera opens: no render loop, one onEnd', async () => {
    const open = deferred();
    h.trackerStart = () => open.promise;
    const { runtime, ends } = setup();
    const started = runtime.start();
    await vi.waitFor(() => expect(log).toContain('tracker.start'));
    runtime.stop();
    open.resolve(); // matar returns quietly when stopped meanwhile
    await started;
    expect(log).not.toContain('loop.on');
    expect(ends).toEqual([undefined]);
  });

  it('camera refused: start rejects, everything is released, no onEnd', async () => {
    h.trackerStart = () =>
      Promise.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const { runtime, ends } = setup();
    await expect(runtime.start()).rejects.toMatchObject({ code: 'permission-denied' });
    expect(log).toEqual(expect.arrayContaining(['canvas.remove', 'renderer.dispose']));
    expect(log).not.toContain('loop.on');
    expect(ends).toEqual([]);
  });

  it('a setup failure before the camera opens also releases everything', async () => {
    h.matarThreeThrows = true;
    const { runtime, ends } = setup();
    await expect(runtime.start()).rejects.toThrow('no WebGL');
    expect(log).toEqual(
      expect.arrayContaining(['tracker.stop', 'canvas.remove', 'renderer.dispose']),
    );
    expect(ends).toEqual([]);
  });

  it('a camera failure after start ends AR once, saying why', async () => {
    const { runtime, ends } = setup();
    await runtime.start();
    const t = h.trackers[0]!;
    t.dispatchEvent(Object.assign(new Event('error'), { code: 'camera-in-use', message: 'busy' }));
    t.dispatchEvent(Object.assign(new Event('state'), { state: 'error' }));
    t.dispatchEvent(Object.assign(new Event('state'), { state: 'error' }));
    runtime.stop();
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatch(/in use by another app/);
  });

  it('selects on a one-finger tap, not on a second finger, a drag or a cancel', async () => {
    const { runtime, selects } = setup();
    await runtime.start();
    (runtime as unknown as { onFrame(): void }).onFrame(); // the mat is in view
    const canvas = (runtime as unknown as { renderer: { domElement: EventTarget } }).renderer
      .domElement;
    // two fingers: lifting the second isn't a tap, nor is the first afterwards
    canvas.dispatchEvent(pointer('pointerdown', 1));
    canvas.dispatchEvent(pointer('pointerdown', 2));
    canvas.dispatchEvent(pointer('pointerup', 2));
    canvas.dispatchEvent(pointer('pointerup', 1));
    // a drag
    canvas.dispatchEvent(pointer('pointerdown', 3, 100, 100));
    canvas.dispatchEvent(pointer('pointerup', 3, 160, 100));
    // a cancelled touch
    canvas.dispatchEvent(pointer('pointerdown', 4));
    canvas.dispatchEvent(pointer('pointercancel', 4));
    canvas.dispatchEvent(pointer('pointerup', 4));
    expect(selects).toEqual([]);
    // a tap
    canvas.dispatchEvent(pointer('pointerdown', 5, 100, 100));
    canvas.dispatchEvent(pointer('pointerup', 5, 104, 103));
    expect(selects).toEqual(['a1']);
  });
});
