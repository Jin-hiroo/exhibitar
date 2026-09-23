import { hasImageTrackingApi } from './xr-image-tracking';

export interface ArCapabilities {
  /** WebXR only works on https:// or localhost */
  secureContext: boolean;
  /** navigator.xr exists */
  webxr: boolean;
  /** an immersive-ar session can be requested */
  immersiveAr: boolean;
  /** the image tracking API is exposed (Chrome: #webxr-incubations flag) */
  imageTracking: boolean;
  /** iPhone / iPad (Safari has no WebXR AR: use the Needle Go App Clip) */
  ios: boolean;
}

export async function detectArCapabilities(): Promise<ArCapabilities> {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const xr = typeof navigator !== 'undefined' ? navigator.xr : undefined;
  let immersiveAr = false;
  if (xr) {
    try {
      immersiveAr = await xr.isSessionSupported('immersive-ar');
    } catch {
      immersiveAr = false;
    }
  }
  return {
    secureContext,
    webxr: !!xr,
    immersiveAr,
    imageTracking: hasImageTrackingApi(),
    ios: isIOS(),
  };
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS reports a Mac user agent; a touch screen gives it away
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
