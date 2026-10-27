/**
 * Short UI messages for Supabase Auth failures (password, sign-up, Google). Errors are
 * `AuthError`s with a server `code` such as "invalid_credentials".
 */

type ErrorLike = { code?: unknown; message?: unknown };

function asErrorLike(err: unknown): ErrorLike | null {
  return typeof err === 'object' && err !== null ? (err as ErrorLike) : null;
}

export function authErrorCode(err: unknown): string | undefined {
  const code = asErrorLike(err)?.code;
  return typeof code === 'string' ? code : undefined;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'This email address is not confirmed yet.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  same_password: 'That is already your password.',
};

/** Message to show for a failed auth call. */
export function authErrorMessage(err: unknown): string {
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
  access_denied: 'Google sign-in was cancelled. Try again, or sign in with email below.',
  signup_disabled: 'New accounts cannot be created right now. If you already have one, sign in.',
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
