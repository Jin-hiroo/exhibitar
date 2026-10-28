import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findSavedCamera,
  loadIntrinsics,
  SAVED_INTRINSICS_KEY,
  saveIntrinsics,
} from './saved-intrinsics';

const K = { width: 720, height: 1280, fx: 1130, fy: 1130, cx: 359.5, cy: 639.5 };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe('saved intrinsics', () => {
  it('round-trips a calibration with its camera label', () => {
    const s = memoryStorage();
    saveIntrinsics({ label: 'camera 0, facing back', intrinsics: K }, s);
    expect(loadIntrinsics(s)).toEqual({ label: 'camera 0, facing back', intrinsics: K });
  });

  it('ignores missing, malformed or implausible entries', () => {
    const s = memoryStorage();
    expect(loadIntrinsics(s)).toBeNull();
    expect(loadIntrinsics(null)).toBeNull();
    for (const bad of [
      'not json',
      '42',
      JSON.stringify({ label: '', intrinsics: K }),
      JSON.stringify({ label: 'cam', intrinsics: { ...K, fx: 0 } }),
      JSON.stringify({ label: 'cam', intrinsics: { ...K, cy: 'x' } }),
      JSON.stringify({ label: 'cam' }),
    ]) {
      s.setItem(SAVED_INTRINSICS_KEY, bad);
      expect(loadIntrinsics(s), bad).toBeNull();
    }
  });

  it('does not throw when storage refuses the write', () => {
    const s = memoryStorage();
    s.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => saveIntrinsics({ label: 'cam', intrinsics: K }, s)).not.toThrow();
  });
});

describe('findSavedCamera', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(cameras: { label: string; deviceId: string }[]) {
    const storage = memoryStorage();
    saveIntrinsics({ label: 'camera 0, facing back', intrinsics: K }, storage);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: async () => cameras.map((c) => ({ ...c, kind: 'videoinput' })),
      },
    });
  }

  it('returns the deviceId of the one camera with the saved name', async () => {
    stub([
      { label: 'camera 1, facing front', deviceId: 'b' },
      { label: 'camera 0, facing back', deviceId: 'a' },
    ]);
    expect(await findSavedCamera()).toMatchObject({ deviceId: 'a', intrinsics: K });
  });

  it('is null without camera names (no permission yet) or when two share the name', async () => {
    stub([{ label: '', deviceId: '' }]);
    expect(await findSavedCamera()).toBeNull();
    stub([
      { label: 'camera 0, facing back', deviceId: 'a' },
      { label: 'camera 0, facing back', deviceId: 'b' },
    ]);
    expect(await findSavedCamera()).toBeNull();
  });
});
