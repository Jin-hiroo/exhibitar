import type { CameraIntrinsics } from 'matar';

/**
 * The focal length matar measured on this phone, kept in `localStorage` with
 * the camera's label (as matar's demo does), so the next visit starts from it
 * instead of calibrating again: `createTracker({ intrinsics, camera: { deviceId } })`.
 * matar only uses it for the same frame size and orientation. Stays on the
 * phone; nothing about the camera is uploaded.
 */
export interface SavedIntrinsics {
  /** `MediaStreamTrack.label` of the camera it was measured on */
  label: string;
  intrinsics: CameraIntrinsics;
}

export const SAVED_INTRINSICS_KEY = 'exhibitar.matar.intrinsics';

/** The saved calibration, or null if there is none or it isn't valid. */
export function loadIntrinsics(storage: Pick<Storage, 'getItem'> | null): SavedIntrinsics | null {
  try {
    const v = JSON.parse(storage?.getItem(SAVED_INTRINSICS_KEY) ?? 'null') as unknown;
    if (!v || typeof v !== 'object') return null;
    const { label, intrinsics: k } = v as Partial<SavedIntrinsics>;
    const ok =
      typeof label === 'string' &&
      label !== '' &&
      !!k &&
      [k.width, k.height, k.fx, k.fy, k.cx, k.cy].every(
        (x) => typeof x === 'number' && Number.isFinite(x) && x > 0,
      );
    return ok ? { label, intrinsics: k } : null;
  } catch {
    return null; // not JSON
  }
}

export function saveIntrinsics(
  s: SavedIntrinsics,
  storage: Storage | null = localStorageOrNull(),
): void {
  try {
    storage?.setItem(SAVED_INTRINSICS_KEY, JSON.stringify(s));
  } catch {
    // storage blocked or full: calibrate again next time
  }
}

/**
 * The saved calibration with the deviceId of its camera, if exactly one camera
 * of that name is listed now. Browsers list camera names only while camera
 * permission is granted, so a first visit (or a one-time grant) gets null and
 * calibrates.
 */
export async function findSavedCamera(): Promise<(SavedIntrinsics & { deviceId: string }) | null> {
  const saved = loadIntrinsics(localStorageOrNull());
  if (!saved || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return null;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(
      (d) => d.kind === 'videoinput' && d.label === saved.label && d.deviceId !== '',
    );
    // two cameras with one name: no telling which was measured, so calibrate afresh
    return cams.length === 1 ? { ...saved, deviceId: cams[0]!.deviceId } : null;
  } catch {
    return null;
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // access denied (e.g. blocked third-party storage)
  }
}
