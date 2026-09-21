import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { createExpenseSchema, updateExpenseSchema } from '@/lib/validation/schemas';
import { ApiError } from '@/lib/api/errors';
import { Pagination, Sort } from '@/lib/api/pagination';
import { z } from 'zod';

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  paymentMethodId?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ExpenseListOptions {
  filters: ExpenseFilters;
  pagination: Pagination;
  sort: Sort;
}

function buildOrderBy(sort: Sort): Prisma.ExpenseOrderByWithRelationInput[] {
  switch (sort.field) {
    case 'amountMinorUnits':
      return [{ amountMinorUnits: sort.order }];
    case 'createdAt':
      return [{ createdAt: sort.order }];
    case 'date':
    default:
      return [{ date: sort.order }];
  }
}

function buildWhere(userId: string, filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {
    userId,
    isDeleted: false,
  };

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.paymentMethodId) where.paymentMethodId = filters.paymentMethodId;

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amountMinorUnits = {};
    if (filters.minAmount !== undefined) where.amountMinorUnits.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) where.amountMinorUnits.lte = filters.maxAmount;
  }

  return where;
}

async function assertCategoryOwnership(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found or does not belong to user');
  }
}

async function assertPaymentMethodOwnership(userId: string, paymentMethodId: string) {
  const paymentMethod = await prisma.paymentMethod.findFirst({ where: { id: paymentMethodId, userId } });
  if (!paymentMethod) {
    throw new ApiError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found or does not belong to user');
  }
}

export class ExpenseService {
  static async createExpense(userId: string, input: CreateExpenseInput) {
    const validated = createExpenseSchema.parse(input);

    await assertCategoryOwnership(userId, validated.categoryId);
    if (validated.paymentMethodId) {
      await assertPaymentMethodOwnership(userId, validated.paymentMethodId);
    }

    return prisma.expense.create({
      data: {
        userId,
        amountMinorUnits: validated.amountMinorUnits,
        currency: validated.currency,
        date: validated.date,
        categoryId: validated.categoryId,
        paymentMethodId: validated.paymentMethodId ?? null,
        description: validated.description ?? null,
        isDeleted: false,
      },
      include: {
        category: true,
        paymentMethod: true,
      },
    });
  }

  static async getExpense(userId: string, expenseId: string) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, userId, isDeleted: false },
      include: { category: true, paymentMethod: true },
    });
    if (!expense) {
      throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    }
    return expense;
  }

  static async updateExpense(userId: string, expenseId: string, input: UpdateExpenseInput) {
    const validated = updateExpenseSchema.parse(input);

    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, userId, isDeleted: false },
    });
    if (!existing) {
      throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    }

    if (validated.categoryId && validated.categoryId !== existing.categoryId) {
      await assertCategoryOwnership(userId, validated.categoryId);
    }

    if (validated.paymentMethodId && validated.paymentMethodId !== existing.paymentMethodId) {
      await assertPaymentMethodOwnership(userId, validated.paymentMethodId);
    }

    const historyData: Array<{ fieldName: string; oldValue: string; newValue: string }> = [];

    if (validated.amountMinorUnits !== undefined && validated.amountMinorUnits !== existing.amountMinorUnits) {
      historyData.push({
        fieldName: 'amountMinorUnits',
        oldValue: existing.amountMinorUnits.toString(),
        newValue: validated.amountMinorUnits.toString(),
      });
    }

    if (validated.categoryId !== undefined && validated.categoryId !== existing.categoryId) {
      historyData.push({
        fieldName: 'categoryId',
        oldValue: existing.categoryId,
        newValue: validated.categoryId,
      });
    }

    if (validated.paymentMethodId !== undefined && validated.paymentMethodId !== existing.paymentMethodId) {
      historyData.push({
        fieldName: 'paymentMethodId',
        oldValue: existing.paymentMethodId || '',
        newValue: validated.paymentMethodId || '',
      });
    }

    if (validated.description !== undefined && validated.description !== existing.description) {
      historyData.push({
        fieldName: 'description',
        oldValue: existing.description || '',
        newValue: validated.description || '',
      });
    }

    if (validated.date !== undefined && validated.date.toISOString() !== existing.date.toISOString()) {
      historyData.push({
        fieldName: 'date',
        oldValue: existing.date.toISOString(),
        newValue: validated.date.toISOString(),
      });
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          ...validated,
          updatedAt: new Date(),
        },
        include: {
          category: true,
          paymentMethod: true,
        },
      });

      for (const history of historyData) {
        await tx.expenseHistory.create({
          data: {
            expenseId: updated.id,
            changedAt: new Date(),
            changedBy: userId,
            fieldName: history.fieldName,
            oldValue: history.oldValue,
            newValue: history.newValue,
          },
        });
      }

      return updated;
    });
  }

  static async softDeleteExpense(userId: string, expenseId: string) {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, userId, isDeleted: false },
    });
    if (!existing) {
      throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    }

    return prisma.expense.update({
      where: { id: expenseId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  static async listExpenses(userId: string, options: ExpenseListOptions) {
    const where = buildWhere(userId, options.filters);

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: options.pagination.offset,
        take: options.pagination.limit,
        orderBy: buildOrderBy(options.sort),
        include: {
          category: true,
          paymentMethod: true,
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return { items, total };
  }
}