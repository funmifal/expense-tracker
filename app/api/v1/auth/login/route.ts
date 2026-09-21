import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/http';
import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { loginUserSchema } from '@/lib/validation/schemas';
import { createSession } from '@/lib/auth/session';

const SESSION_COOKIE = 'next-auth.session-token';

function toUserDto(user: { id: string; email: string; currency: string; planTier: string }) {
  return {
    id: user.id,
    email: user.email,
    currency: user.currency,
    planTier: user.planTier,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = loginUserSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    const isValid =
      user !== null && (await bcrypt.compare(validated.password, user.passwordHash));
    if (!isValid) {
      return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const sessionToken = await createSession(user!.id);

    const res = ok({ user: toUserDto(user!) });
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