import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession } from '@/lib/auth/session';

export async function POST() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('next-auth.session-token')?.value;

  if (sessionToken) {
    await revokeSession(sessionToken);
  }

  const res = NextResponse.json({ success: true }, { status: 200 });
  res.cookies.delete('next-auth.session-token');
  return res;
}
