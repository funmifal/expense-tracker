import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { ok } from '@/lib/api/http';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { UserService } from '@/lib/users/user-service';
import { fail } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

function toUserDto(user: { id: string; email: string; currency: string; planTier: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    currency: user.currency,
    planTier: user.planTier,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const profile = await UserService.getCurrentUser(user.id);
    return ok({ user: toUserDto(profile) });
  } catch (error) {
    return handleError(error);
  }
}