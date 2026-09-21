import { cookies } from 'next/headers';
import { getSessionUser } from './session';

export async function getAuthenticatedUser(req?: Request) {
  let token: string | undefined;

  // Check Cookie
  const cookieStore = cookies();
  token = cookieStore.get('next-auth.session-token')?.value;

  // Check Authorization Header fallback
  if (!token && req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;
  return getSessionUser(token);
}
