import { describe, expect, it } from 'vitest';
import { arAvailable, inAppBrowser } from './capabilities';

describe('inAppBrowser', () => {
  it('names the app from its user-agent token', () => {
    expect(
      inAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.30.97',
      ),
    ).toBe('Instagram');
    expect(
      inAppBrowser(
        'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 Line/14.10.0',
      ),
    ).toBe('LINE');
    expect(
      inAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]',
      ),
    ).toBe('Facebook');
  });

  it('is null for Safari and Chrome', () => {
    expect(
      inAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBeNull();
    expect(
      inAppBrowser(
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
      ),
    ).toBeNull();
  });
});

describe('arAvailable', () => {
  const ok = { secureContext: true, camera: true, webgl: true, inAppBrowser: null, ios: false };
  it('needs a secure context, the camera API and WebGL', () => {
    expect(arAvailable(ok)).toBe(true);
    expect(arAvailable({ ...ok, secureContext: false })).toBe(false);
    expect(arAvailable({ ...ok, camera: false })).toBe(false);
    expect(arAvailable({ ...ok, webgl: false })).toBe(false);
    // an in-app browser may still open the camera: AR is offered with a note
    expect(arAvailable({ ...ok, inAppBrowser: 'LINE' })).toBe(true);
  });
});
