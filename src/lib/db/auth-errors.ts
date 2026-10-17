/**
 * Short UI messages for Supabase Auth failures (password, sign-up, passkeys, Google).
 * Errors are either `AuthError`s (server `code` such as "invalid_credentials") or
 * `WebAuthnError`s from the browser ceremony (`code` such as "ERROR_CEREMONY_ABORTED").
 */

type ErrorLike = { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };

function asErrorLike(err: unknown): ErrorLike | null {
  return typeof err === 'object' && err !== null ? (err as ErrorLike) : null;
}

export function authErrorCode(err: unknown): string | undefined {
  const code = asErrorLike(err)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** The user dismissed the passkey prompt, or a newer ceremony replaced this one. */
export function isPasskeyCancel(err: unknown): boolean {
  if (authErrorCode(err) === 'ERROR_CEREMONY_ABORTED') return true;
  const cause = asErrorLike(asErrorLike(err)?.cause);
  return cause?.name === 'NotAllowedError' || cause?.name === 'AbortError';
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'This email address is not confirmed yet.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  same_password: 'That is already your password.',
  passkey_disabled: 'Passkeys are not enabled for this site yet. Use your email and password.',
  webauthn_credential_not_found:
    'This passkey is not registered here any more. Sign in with your password and add it again.',
  webauthn_challenge_expired: 'The passkey prompt timed out. Try again.',
  webauthn_challenge_not_found: 'The passkey prompt timed out. Try again.',
  webauthn_credential_exists: 'This device already has a passkey for your account.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'This device already has a passkey for your account.',
  too_many_passkeys: 'You have the maximum number of passkeys. Remove one first.',
  ERROR_INVALID_RP_ID:
    'Passkeys are not set up for this web address. Use your password here, or the main site.',
  ERROR_INVALID_DOMAIN:
    'Passkeys are not set up for this web address. Use your password here, or the main site.',
};

/** Message to show for a failed auth call, or null when there is nothing to report (cancelled). */
export function authErrorMessage(err: unknown): string | null {
  if (isPasskeyCancel(err)) return null;
  const code = authErrorCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = asErrorLike(err)?.message;
  return typeof message === 'string' && message ? message : 'Something went wrong. Try again.';
}

export const NOT_CONFIGURED = 'Sign-in is not configured (missing Supabase env vars).';

const OTHER_BROWSER = 'Finish Google sign-in in the browser you started it in, then try again.';

/**
 * Codes that `/auth/callback` passes back to the login page (`?error=`): OAuth errors from
 * Supabase (`error_code`, else `error`) or the code exchange's `AuthError` code.
 */
const OAUTH_MESSAGES: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  signup_disabled: 'New accounts cannot be created right now.',
  flow_state_expired: 'Google sign-in took too long. Try again.',
  flow_state_not_found: OTHER_BROWSER,
  bad_code_verifier: OTHER_BROWSER,
  pkce_code_verifier_not_found: OTHER_BROWSER,
  not_configured: NOT_CONFIGURED,
};

/**
 * Message for the login page's `?error=` code after a failed Google sign-in, or null when
 * there is none. The code comes from the URL, so only these fixed texts are ever shown.
 */
export function oauthErrorMessage(code: unknown): string | null {
  if (typeof code !== 'string' || !code) return null;
  return Object.hasOwn(OAUTH_MESSAGES, code)
    ? OAUTH_MESSAGES[code]
    : 'Google sign-in did not finish. Try again.';
}
