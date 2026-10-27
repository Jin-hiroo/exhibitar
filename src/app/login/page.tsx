import { SignInSheet } from '@/components/studio/SignInSheet';
import { oauthErrorMessage } from '@/lib/db/auth-errors';
import { supabaseEnv } from '@/lib/db/env';
import { isGoogleSignInEnabled } from '@/lib/db/server';
import { safeNextPath } from '@/lib/safe-redirect';

/** The same sign-in as the signed-out Studio, for pages that send people here (`?next=`). */
export default async function LoginPage(props: PageProps<'/login'>) {
  const [sp, google] = await Promise.all([props.searchParams, isGoogleSignInEnabled()]);
  return (
    <SignInSheet
      next={safeNextPath(sp.next)}
      google={google}
      error={oauthErrorMessage(sp.error)}
      configured={!!supabaseEnv()}
    />
  );
}
