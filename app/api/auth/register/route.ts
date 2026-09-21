import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { registerUserSchema } from '@/lib/validation/schemas';
import { createSession } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = registerUserSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        passwordHash,
        currency: validated.currency,
      },
    });

    // Seed default categories for new user
    const defaultCategories = [
      'Housing', 'Groceries', 'Dining Out', 'Utilities',
      'Transportation', 'Entertainment', 'Health', 'Shopping', 'Subscriptions'
    ];

    for (const name of defaultCategories) {
      await prisma.category.create({
        data: {
          userId: user.id,
          name,
          isDefault: true,
        },
      });
    }

    // Seed default payment methods
    const defaultPaymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer'];
    for (const name of defaultPaymentMethods) {
      await prisma.paymentMethod.create({
        data: {
          userId: user.id,
          name,
        },
      });
    }

    const sessionToken = await createSession(user.id);

    const res = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          currency: user.currency,
          planTier: user.planTier,
        },
      },
      { status: 201 }
    );

    res.cookies.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res;
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
