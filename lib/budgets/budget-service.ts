import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { createBudgetSchema, updateBudgetSchema } from '@/lib/validation/schemas';
import { calculatePercentage } from '@/lib/money/money';
import { ApiError } from '@/lib/api/errors';
import { Pagination, Sort } from '@/lib/api/pagination';
import { z } from 'zod';

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export interface BudgetListOptions {
  filters: { periodStart?: Date; categoryId?: string };
  pagination: Pagination;
  sort: Sort;
}

function buildOrderBy(sort: Sort): Prisma.BudgetOrderByWithRelationInput[] {
  switch (sort.field) {
    case 'amountMinorUnits':
      return [{ amountMinorUnits: sort.order }];
    case 'createdAt':
      return [{ createdAt: sort.order }];
    case 'periodStart':
    default:
      return [{ periodStart: sort.order }];
  }
}

export class BudgetService {
  static async createBudget(userId: string, input: CreateBudgetInput) {
    const validated = createBudgetSchema.parse(input);

    if (validated.categoryId === null || validated.categoryId === undefined) {
      const existingOverall = await prisma.budget.findFirst({
        where: {
          userId,
          categoryId: null,
          periodStart: validated.periodStart,
        },
      });
      if (existingOverall) {
        throw new ApiError(409, 'BUDGET_EXISTS', 'An overall budget already exists for this period');
      }
    } else {
      const category = await prisma.category.findFirst({
        where: { id: validated.categoryId, userId },
      });
      if (!category) {
        throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found or does not belong to user');
      }

      const existingCategoryBudget = await prisma.budget.findFirst({
        where: {
          userId,
          categoryId: validated.categoryId,
          periodStart: validated.periodStart,
        },
      });
      if (existingCategoryBudget) {
        throw new ApiError(409, 'BUDGET_EXISTS', 'A budget for this category already exists for this period');
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

  static async getBudget(userId: string, budgetId: string) {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: { category: true },
    });
    if (!budget) {
      throw new ApiError(404, 'BUDGET_NOT_FOUND', 'Budget not found');
    }
    return budget;
  }

  static async updateBudget(userId: string, budgetId: string, input: UpdateBudgetInput) {
    const validated = updateBudgetSchema.parse(input);

    const existing = await this.getBudget(userId, budgetId);

    const periodEnd = new Date(
      Date.UTC(existing.periodStart.getUTCFullYear(), existing.periodStart.getUTCMonth() + 1, 1),
    );

    const expenseWhere: Prisma.ExpenseWhereInput = {
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
    const spentMinorUnits = spendingSum._sum.amountMinorUnits ?? 0;

    return prisma.$transaction(async (tx) => {
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

  static async listBudgets(userId: string, options: BudgetListOptions) {
    const where: Prisma.BudgetWhereInput = { userId };

    if (options.filters.periodStart) {
      where.periodStart = options.filters.periodStart;
    }
    if (options.filters.categoryId) {
      where.categoryId = options.filters.categoryId;
    }

    const [items, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        skip: options.pagination.offset,
        take: options.pagination.limit,
        orderBy: buildOrderBy(options.sort),
        include: { category: true },
      }),
      prisma.budget.count({ where }),
    ]);

    return { items, total };
  }

  static async getBudgetUsage(userId: string, periodStart: Date) {
    const periodEnd = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
    );

    const budgets = await prisma.budget.findMany({
      where: { userId, periodStart },
      include: { category: true },
    });

    const usageReport = [];

    for (const budget of budgets) {
      const expenseWhere: Prisma.ExpenseWhereInput = {
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
      const spentMinorUnits = spendingSum._sum.amountMinorUnits ?? 0;
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
        categoryName: budget.category?.name ?? 'Overall',
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