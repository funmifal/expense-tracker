import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface AuthSession {
  user: {
    id: string;
    email: string;
    currency: string;
    planTier: string;
  };
  sessionToken: string;
}

/**
 * Creates a database session for an authenticated user.
 */
export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
    },
  });

  return sessionToken;
}

/**
 * Verifies a session token and returns the authenticated user if valid and non-expired.
 */
export async function getSessionUser(sessionToken?: string): Promise<AuthSession['user'] | null> {
  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      // Clean up expired session
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    currency: session.user.currency,
    planTier: session.user.planTier,
  };
}

/**
 * Revokes a database session token (logout).
 */
export async function revokeSession(sessionToken: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { sessionToken } });
    return true;
  } catch {
    return false;
  }
}
