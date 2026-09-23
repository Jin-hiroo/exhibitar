import { NextResponse, type NextRequest } from 'next/server';
import { getServerDb } from '@/lib/db/server';

export async function POST(request: NextRequest) {
  const db = await getServerDb();
  await db?.auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}/`, { status: 303 });
}
