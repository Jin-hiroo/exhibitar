import { describe, expect, it } from 'vitest';
import { authErrorCode, authErrorMessage, isPasskeyCancel, oauthErrorMessage } from './auth-errors';

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

describe('oauthErrorMessage', () => {
  it('maps the codes /auth/callback sends back', () => {
    expect(oauthErrorMessage('access_denied')).toBe('Google sign-in was cancelled.');
    expect(oauthErrorMessage('flow_state_expired')).toMatch(/took too long/);
    expect(oauthErrorMessage('pkce_code_verifier_not_found')).toMatch(/browser you started it in/);
    expect(oauthErrorMessage('not_configured')).toMatch(/not configured/);
  });

  it('never echoes the URL value', () => {
    const generic = 'Google sign-in did not finish. Try again.';
    expect(oauthErrorMessage('Your account is locked. Call +1 555 0100')).toBe(generic);
    expect(oauthErrorMessage('constructor')).toBe(generic);
    expect(oauthErrorMessage('__proto__')).toBe(generic);
  });

  it('is null without a code', () => {
    expect(oauthErrorMessage(undefined)).toBeNull();
    expect(oauthErrorMessage('')).toBeNull();
    expect(oauthErrorMessage(['access_denied', 'x'])).toBeNull();
  });
});
