import { cookies } from 'next/headers';
import { ok } from '@/lib/api/http';
import { revokeSession } from '@/lib/auth/session';

const SESSION_COOKIE = 'next-auth.session-token';

export async function POST() {
  const sessionToken = cookies().get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await revokeSession(sessionToken);
  }

  const res = ok({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}