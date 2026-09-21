import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { ok } from '@/lib/api/http';
import { UserService } from '@/lib/users/user-service';
import { createSession } from '@/lib/auth/session';

function toUserDto(user: { id: string; email: string; currency: string; planTier: string }) {
  return {
    id: user.id,
    email: user.email,
    currency: user.currency,
    planTier: user.planTier,
  };
}

const SESSION_COOKIE = 'next-auth.session-token';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await UserService.registerUser(body);

    const sessionToken = await createSession(user.id);

    const res = ok({ user: toUserDto(user) }, 201);
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return res;
  } catch (error) {
    return handleError(error);
  }
}