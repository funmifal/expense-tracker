import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { createPaymentMethodSchema, updatePaymentMethodSchema } from '@/lib/validation/schemas';
import { ApiError } from '@/lib/api/errors';
import { Pagination, Sort } from '@/lib/api/pagination';
import { z } from 'zod';

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

export interface PaymentMethodListOptions {
  filters: { name?: string; id?: string };
  pagination: Pagination;
  sort: Sort;
}

function buildOrderBy(sort: Sort): Prisma.PaymentMethodOrderByWithRelationInput[] {
  switch (sort.field) {
    case 'id':
      return [{ id: sort.order }];
    case 'name':
    default:
      return [{ name: sort.order }];
  }
}

export class PaymentMethodService {
  static async createPaymentMethod(userId: string, input: CreatePaymentMethodInput) {
    const validated = createPaymentMethodSchema.parse(input);

    const existing = await prisma.paymentMethod.findUnique({
      where: { userId_name: { userId, name: validated.name } },
    });
    if (existing) {
      throw new ApiError(409, 'PAYMENT_METHOD_EXISTS', 'A payment method with this name already exists');
    }

    return prisma.paymentMethod.create({
      data: {
        userId,
        name: validated.name,
      },
    });
  }

  static async getPaymentMethod(userId: string, paymentMethodId: string) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });
    if (!paymentMethod) {
      throw new ApiError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found');
    }
    return paymentMethod;
  }

  static async updatePaymentMethod(userId: string, paymentMethodId: string, input: UpdatePaymentMethodInput) {
    const validated = updatePaymentMethodSchema.parse(input);
    await this.getPaymentMethod(userId, paymentMethodId);

    if (validated.name !== undefined) {
      const duplicate = await prisma.paymentMethod.findFirst({
        where: { userId, name: validated.name, NOT: { id: paymentMethodId } },
      });
      if (duplicate) {
        throw new ApiError(409, 'PAYMENT_METHOD_EXISTS', 'A payment method with this name already exists');
      }
    }

    return prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { name: validated.name },
    });
  }

  static async deletePaymentMethod(userId: string, paymentMethodId: string) {
    await this.getPaymentMethod(userId, paymentMethodId);
    return prisma.paymentMethod.delete({ where: { id: paymentMethodId } });
  }

  static async listPaymentMethods(userId: string, options: PaymentMethodListOptions) {
    const { pagination, sort } = options;
    const where: Prisma.PaymentMethodWhereInput = { userId };

    if (options.filters.name) {
      where.name = { contains: options.filters.name, mode: 'insensitive' };
    }
    if (options.filters.id) {
      where.id = options.filters.id;
    }

    const [items, total] = await Promise.all([
      prisma.paymentMethod.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: buildOrderBy(sort),
      }),
      prisma.paymentMethod.count({ where }),
    ]);

    return { items, total };
  }
}