import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { registerUserSchema } from '@/lib/validation/schemas';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';

export const DEFAULT_CATEGORY_NAMES = [
  'Housing',
  'Groceries',
  'Dining Out',
  'Utilities',
  'Transportation',
  'Entertainment',
  'Health',
  'Shopping',
  'Subscriptions',
];

export const DEFAULT_PAYMENT_METHOD_NAMES = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer'];

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export class UserService {
  static async registerUser(input: RegisterUserInput) {
    const validated = registerUserSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { email: validated.email } });
    if (existing) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash,
          currency: validated.currency,
        },
      });

      await tx.category.createMany({
        data: DEFAULT_CATEGORY_NAMES.map((name) => ({ userId: user.id, name, isDefault: true })),
      });

      await tx.paymentMethod.createMany({
        data: DEFAULT_PAYMENT_METHOD_NAMES.map((name) => ({ userId: user.id, name })),
      });

      return user;
    });
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return user;
  }
}