import { describe, expect, it } from 'vitest';
import { signedInWithGoogle } from './auth-method';

describe('signedInWithGoogle', () => {
  it('reads the detailed amr format Supabase issues', () => {
    expect(signedInWithGoogle([{ method: 'oauth', timestamp: 1_760_000_000 }])).toBe(true);
    expect(signedInWithGoogle([{ method: 'password', timestamp: 1_760_000_000 }])).toBe(false);
  });

  it('reads the RFC 8176 string format', () => {
    expect(signedInWithGoogle(['oauth'])).toBe(true);
    expect(signedInWithGoogle(['password'])).toBe(false);
  });

  it('finds the sign-in among several methods (e.g. a second factor)', () => {
    const totp = { method: 'totp', timestamp: 1_760_000_100 };
    expect(signedInWithGoogle([{ method: 'oauth', timestamp: 1_760_000_000 }, totp])).toBe(true);
    expect(signedInWithGoogle([{ method: 'password', timestamp: 1_760_000_000 }, totp])).toBe(
      false,
    );
  });

  it('is false without the claim', () => {
    expect(signedInWithGoogle(undefined)).toBe(false);
    expect(signedInWithGoogle([])).toBe(false);
  });
});
