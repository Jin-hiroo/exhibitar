/**
 * What the AR viewer needs from the browser (docs/MATAR-MIGRATION.md M4):
 * a secure context, the camera API and WebGL. No WebXR: matar tracks the
 * printed tags in the page, the same in iOS Safari and Android Chrome.
 */
export interface ArCapabilities {
  /** the camera only opens on https:// or localhost */
  secureContext: boolean;
  /** navigator.mediaDevices.getUserMedia exists */
  camera: boolean;
  /** a WebGL 2 context can be created (three.js needs it since r163) */
  webgl: boolean;
  /**
   * the page is open in an app's built-in browser (Instagram, LINE, …), where
   * the camera is often blocked: tell the visitor to open it in Safari or Chrome
   */
  inAppBrowser: string | null;
  /** iPhone / iPad (for wording only) */
  ios: boolean;
}

export function detectArCapabilities(): ArCapabilities {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return {
    secureContext: typeof window !== 'undefined' && window.isSecureContext,
    camera:
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function',
    webgl: hasWebGl(),
    inAppBrowser: inAppBrowser(ua),
    ios: isIOS(ua),
  };
}

/** True when AR can be started (the camera prompt may still be refused). */
export function arAvailable(c: ArCapabilities): boolean {
  return c.secureContext && c.camera && c.webgl;
}

/**
 * The app whose built-in browser this is, from its user-agent token, or null.
 * Only apps known to add a token; the list errs on the side of saying nothing.
 */
export function inAppBrowser(ua: string): string | null {
  const apps: [RegExp, string][] = [
    [/\bInstagram\b/, 'Instagram'],
    [/\bFBAN\/|\bFBAV\/|\bFB_IAB\//, 'Facebook'],
    [/\bLine\//, 'LINE'],
    [/\bMicroMessenger\//, 'WeChat'],
    [/\bTwitter\b/, 'X'],
    [/\bmusical_ly_|\bBytedanceWebview\b/, 'TikTok'],
    [/\bSnapchat\b/, 'Snapchat'],
  ];
  return apps.find(([re]) => re.test(ua))?.[1] ?? null;
}

function isIOS(ua: string): boolean {
  // iPadOS reports a Mac user agent; a touch screen gives it away
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  );
}

function hasWebGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
