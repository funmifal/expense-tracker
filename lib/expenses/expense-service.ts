import prisma from '@/lib/db/prisma';
import { createExpenseSchema, updateExpenseSchema, filterExpensesSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type FilterExpensesRawInput = z.input<typeof filterExpensesSchema>;

export class ExpenseService {
  /**
   * Creates a new manual expense record for the authenticated user.
   */
  static async createExpense(userId: string, input: CreateExpenseInput) {
    const validated = createExpenseSchema.parse(input);

    // Verify category ownership
    const category = await prisma.category.findFirst({
      where: { id: validated.categoryId, userId },
    });
    if (!category) {
      throw new Error('Category not found or does not belong to user');
    }

    // Verify payment method ownership if provided
    if (validated.paymentMethodId) {
      const pm = await prisma.paymentMethod.findFirst({
        where: { id: validated.paymentMethodId, userId },
      });
      if (!pm) {
        throw new Error('Payment method not found or does not belong to user');
      }
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

  /**
   * Updates an existing expense and records ExpenseHistory audit entries for changed fields.
   */
  static async updateExpense(userId: string, expenseId: string, input: UpdateExpenseInput) {
    const validated = updateExpenseSchema.parse(input);

    // Fetch existing expense scoped by userId
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, userId, isDeleted: false },
    });

    if (!existing) {
      throw new Error('Expense not found or unauthorized');
    }

    // Validate new category if provided
    if (validated.categoryId && validated.categoryId !== existing.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: validated.categoryId, userId },
      });
      if (!cat) throw new Error('Category not found or unauthorized');
    }

    // Validate new payment method if provided
    if (validated.paymentMethodId && validated.paymentMethodId !== existing.paymentMethodId) {
      const pm = await prisma.paymentMethod.findFirst({
        where: { id: validated.paymentMethodId, userId },
      });
      if (!pm) throw new Error('Payment method not found or unauthorized');
    }

    // Identify changed fields and prepare audit history records
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

    // Transactionally update expense and insert history records
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

      for (const h of historyData) {
        await tx.expenseHistory.create({
          data: {
            expenseId: updated.id,
            changedAt: new Date(),
            changedBy: userId,
            fieldName: h.fieldName,
            oldValue: h.oldValue,
            newValue: h.newValue,
          },
        });
      }

      return updated;
    });
  }

  /**
   * Soft-deletes an expense record (isDeleted = true, deletedAt = now).
   */
  static async softDeleteExpense(userId: string, expenseId: string) {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, userId, isDeleted: false },
    });

    if (!existing) {
      throw new Error('Expense not found or unauthorized');
    }

    return prisma.expense.update({
      where: { id: expenseId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Lists non-deleted expenses for the user with optional filters.
   */
  static async getExpenses(userId: string, filterInput?: FilterExpensesRawInput) {
    const filter = filterExpensesSchema.parse(filterInput || {});

    const where: any = {
      userId,
      isDeleted: false,
    };

    if (filter.startDate || filter.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = filter.startDate;
      if (filter.endDate) where.date.lte = filter.endDate;
    }

    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.paymentMethodId) where.paymentMethodId = filter.paymentMethodId;

    if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
      where.amountMinorUnits = {};
      if (filter.minAmount !== undefined) where.amountMinorUnits.gte = filter.minAmount;
      if (filter.maxAmount !== undefined) where.amountMinorUnits.lte = filter.maxAmount;
    }

    return prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        category: true,
        paymentMethod: true,
      },
    });
  }
}
