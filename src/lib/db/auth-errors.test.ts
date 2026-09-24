import { describe, expect, it } from 'vitest';
import { authErrorCode, authErrorMessage, isPasskeyCancel } from './auth-errors';

const named = (name: string) => Object.assign(new Error('x'), { name });

describe('authErrorMessage', () => {
  it('maps known server codes', () => {
    const err = Object.assign(new Error('Invalid login credentials'), {
      code: 'invalid_credentials',
    });
    expect(authErrorCode(err)).toBe('invalid_credentials');
    expect(authErrorMessage(err)).toBe('Wrong email or password.');
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/already exists/);
    expect(authErrorMessage({ code: 'passkey_disabled' })).toMatch(/not enabled/);
  });

  it('falls back to the error message, then a generic one', () => {
    expect(authErrorMessage({ code: 'weak_password', message: 'Password is too short' })).toBe(
      'Password is too short',
    );
    expect(authErrorMessage(new Error('Browser does not support WebAuthn'))).toBe(
      'Browser does not support WebAuthn',
    );
    expect(authErrorMessage(null)).toBe('Something went wrong. Try again.');
  });

  it('stays quiet when the passkey prompt was dismissed or replaced', () => {
    const aborted = { code: 'ERROR_CEREMONY_ABORTED', message: 'aborted' };
    const dismissed = {
      code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
      message: 'The operation either timed out or was not allowed.',
      cause: named('NotAllowedError'),
    };
    expect(isPasskeyCancel(aborted)).toBe(true);
    expect(isPasskeyCancel(dismissed)).toBe(true);
    expect(authErrorMessage(aborted)).toBeNull();
    expect(authErrorMessage(dismissed)).toBeNull();
    expect(isPasskeyCancel({ code: 'webauthn_verification_failed' })).toBe(false);
  });
});
