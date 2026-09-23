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
  return { secureContext, webxr: !!xr, immersiveAr, imageTracking: hasImageTrackingApi() };
}
