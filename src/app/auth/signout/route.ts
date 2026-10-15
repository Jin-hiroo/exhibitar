import { NextResponse, type NextRequest } from 'next/server';
import { getServerDb } from '@/lib/db/server';

export async function POST(request: NextRequest) {
  // Browsers send Origin on cross-site form posts: refuse those (logout CSRF).
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse('Cross-site sign-out refused', { status: 403 });
  }
  const db = await getServerDb();
  await db?.auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}/`, { status: 303 });
}
