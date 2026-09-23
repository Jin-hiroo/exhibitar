/**
 * WebXR Image Tracking bindings (https://immersive-web.github.io/image-tracking/).
 * Not in @types/webxr yet, and Chrome's flag-gated implementation predates
 * the final spec names, so both spellings are handled here and nowhere else.
 *
 * Android Chrome: needs ARCore and chrome://flags/#webxr-incubations.
 */

export interface XRTrackedImageInit {
  image: ImageBitmap;
  widthInMeters: number;
}

export type XRImageTrackingState = 'untracked' | 'tracked' | 'emulated';
export type XRImageTrackability = 'untrackable' | 'trackable';

export interface XRImageTrackingResult {
  readonly imageSpace: XRSpace;
  readonly index: number;
  readonly trackingState: XRImageTrackingState;
  readonly measuredWidthInMeters: number;
}

type FrameWithTracking = XRFrame & {
  getImageTrackingResults?: () => readonly XRImageTrackingResult[];
};

type SessionWithTracking = XRSession & {
  /** spec name */
  getImageTrackability?: () => Promise<readonly XRImageTrackability[]>;
  /** Chrome's original name */
  getTrackedImageScores?: () => Promise<readonly XRImageTrackability[]>;
};

/** Feature descriptors: Chrome's original and the spec's current name. */
export const IMAGE_TRACKING_FEATURES = ['image-tracking', 'marker-tracking'];

/** True when this browser exposes the per-frame image tracking API at all. */
export function hasImageTrackingApi(): boolean {
  const frameProto = (globalThis as { XRFrame?: { prototype: object } }).XRFrame?.prototype;
  return !!frameProto && 'getImageTrackingResults' in frameProto;
}

export function imageTrackingEnabled(session: XRSession): boolean {
  const enabled = session.enabledFeatures;
  if (enabled) return IMAGE_TRACKING_FEATURES.some((f) => enabled.includes(f));
  return hasImageTrackingApi();
}

export function getImageTrackingResults(frame: XRFrame): readonly XRImageTrackingResult[] {
  return (frame as FrameWithTracking).getImageTrackingResults?.() ?? [];
}

/** Per-image suitability as judged by the platform (e.g. ARCore feature score). */
export async function getImageTrackability(
  session: XRSession,
): Promise<readonly XRImageTrackability[] | null> {
  const s = session as SessionWithTracking;
  if (s.getImageTrackability) return s.getImageTrackability();
  if (s.getTrackedImageScores) return s.getTrackedImageScores();
  return null;
}
