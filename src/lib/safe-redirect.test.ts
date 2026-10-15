import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-redirect';

describe('safeNextPath', () => {
  it('keeps same-site paths with query and hash', () => {
    expect(safeNextPath('/studio')).toBe('/studio');
    expect(safeNextPath('/studio/abc123/calibrate')).toBe('/studio/abc123/calibrate');
    expect(safeNextPath('/studio/account?new=1#passkeys')).toBe('/studio/account?new=1#passkeys');
  });

  it('falls back for missing or non-path values', () => {
    expect(safeNextPath(undefined)).toBe('/studio');
    expect(safeNextPath(['/studio', '/x'])).toBe('/studio');
    expect(safeNextPath('')).toBe('/studio');
    expect(safeNextPath('studio')).toBe('/studio');
    expect(safeNextPath('https://evil.example/')).toBe('/studio');
    expect(safeNextPath('javascript:alert(1)')).toBe('/studio');
  });

  it('rejects paths that browsers resolve to another host', () => {
    expect(safeNextPath('//evil.example')).toBe('/studio');
    expect(safeNextPath('//evil.example/studio')).toBe('/studio');
    expect(safeNextPath('/\\evil.example')).toBe('/studio');
    expect(safeNextPath('/\t/evil.example')).toBe('/studio');
    expect(safeNextPath('/\n/evil.example')).toBe('/studio');
  });

  it('uses the given fallback', () => {
    expect(safeNextPath('//evil.example', '/')).toBe('/');
  });
});
