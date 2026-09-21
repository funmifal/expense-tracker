import prisma from '@/lib/db/prisma';
import { createBudgetSchema, updateBudgetSchema } from '@/lib/validation/schemas';
import { calculatePercentage } from '@/lib/money/money';
import { z } from 'zod';

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export class BudgetService {
  /**
   * Creates a new monthly budget (overall or per-category) for the user.
   */
  static async createBudget(userId: string, input: CreateBudgetInput) {
    const validated = createBudgetSchema.parse(input);

    // Defense-in-depth: Reject second null-category (overall) budget for same user+period
    if (validated.categoryId === null || validated.categoryId === undefined) {
      const existingOverall = await prisma.budget.findFirst({
        where: {
          userId,
          categoryId: null,
          periodStart: validated.periodStart,
        },
      });

      if (existingOverall) {
        throw new Error('An overall budget already exists for this period');
      }
    } else {
      // Validate category ownership
      const cat = await prisma.category.findFirst({
        where: { id: validated.categoryId, userId },
      });
      if (!cat) throw new Error('Category not found or unauthorized');

      const existingCategoryBudget = await prisma.budget.findFirst({
        where: {
          userId,
          categoryId: validated.categoryId,
          periodStart: validated.periodStart,
        },
      });

      if (existingCategoryBudget) {
        throw new Error('A budget for this category already exists for this period');
      }
    }

    return prisma.budget.create({
      data: {
        userId,
        categoryId: validated.categoryId ?? null,
        amountMinorUnits: validated.amountMinorUnits,
        periodStart: validated.periodStart,
      },
      include: {
        category: true,
      },
    });
  }

  /**
   * Updates an existing budget mid-period, creating a BudgetPeriodSnapshot to preserve historical integrity.
   */
  static async updateBudget(userId: string, budgetId: string, input: UpdateBudgetInput) {
    const validated = updateBudgetSchema.parse(input);

    const existing = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: { category: true },
    });

    if (!existing) {
      throw new Error('Budget not found or unauthorized');
    }

    // Calculate current spending for this budget's category & period
    const periodEnd = new Date(Date.UTC(existing.periodStart.getUTCFullYear(), existing.periodStart.getUTCMonth() + 1, 1));
    
    const expenseWhere: any = {
      userId,
      isDeleted: false,
      date: {
        gte: existing.periodStart,
        lt: periodEnd,
      },
    };

    if (existing.categoryId) {
      expenseWhere.categoryId = existing.categoryId;
    }

    const spendingSum = await prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amountMinorUnits: true },
    });

    const spentMinorUnits = spendingSum._sum.amountMinorUnits || 0;

    return prisma.$transaction(async (tx) => {
      // Write snapshot before modifying the budget amount
      await tx.budgetPeriodSnapshot.create({
        data: {
          budgetId: existing.id,
          userId,
          categoryId: existing.categoryId,
          periodStart: existing.periodStart,
          budgetAmountMinorUnits: existing.amountMinorUnits,
          spentMinorUnits,
          closedAt: new Date(),
        },
      });

      // Apply mid-period budget edit prospectively
      return tx.budget.update({
        where: { id: budgetId },
        data: {
          amountMinorUnits: validated.amountMinorUnits,
          updatedAt: new Date(),
        },
        include: {
          category: true,
        },
      });
    });
  }

  /**
   * Calculates real-time budget usage and threshold alerts (80% / 100%+).
   */
  static async getBudgetUsage(userId: string, periodStart: Date) {
    const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1));

    const budgets = await prisma.budget.findMany({
      where: { userId, periodStart },
      include: { category: true },
    });

    const usageReport = [];

    for (const budget of budgets) {
      const expenseWhere: any = {
        userId,
        isDeleted: false,
        date: {
          gte: periodStart,
          lt: periodEnd,
        },
      };

      if (budget.categoryId) {
        expenseWhere.categoryId = budget.categoryId;
      }

      const spendingSum = await prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amountMinorUnits: true },
      });

      const spentMinorUnits = spendingSum._sum.amountMinorUnits || 0;
      const percentage = calculatePercentage(spentMinorUnits, budget.amountMinorUnits);
      const remainingMinorUnits = Math.max(0, budget.amountMinorUnits - spentMinorUnits);

      let alertStatus = 'OK';
      if (percentage >= 100) {
        alertStatus = 'EXCEEDED_100';
      } else if (percentage >= 80) {
        alertStatus = 'WARNING_80';
      }

      usageReport.push({
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name || 'Overall',
        budgetAmountMinorUnits: budget.amountMinorUnits,
        spentMinorUnits,
        remainingMinorUnits,
        percentage,
        alertStatus,
      });
    }

    return usageReport;
  }
}
