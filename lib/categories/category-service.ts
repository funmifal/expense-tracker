import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { createCategorySchema, updateCategorySchema } from '@/lib/validation/schemas';
import { ApiError } from '@/lib/api/errors';
import { Pagination, Sort } from '@/lib/api/pagination';
import { z } from 'zod';

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface CategoryListOptions {
  filters: { name?: string; isDefault?: boolean };
  pagination: Pagination;
  sort: Sort;
}

function buildOrderBy(sort: Sort): Prisma.CategoryOrderByWithRelationInput[] {
  switch (sort.field) {
    case 'createdAt':
      return [{ createdAt: sort.order }];
    case 'name':
    default:
      return [{ name: sort.order }];
  }
}

export class CategoryService {
  static async createCategory(userId: string, input: CreateCategoryInput) {
    const validated = createCategorySchema.parse(input);

    const existing = await prisma.category.findUnique({
      where: { userId_name: { userId, name: validated.name } },
    });
    if (existing) {
      throw new ApiError(409, 'CATEGORY_EXISTS', 'A category with this name already exists');
    }

    return prisma.category.create({
      data: {
        userId,
        name: validated.name,
        isDefault: validated.isDefault ?? false,
      },
    });
  }

  static async getCategory(userId: string, categoryId: string) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  }

  static async updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const validated = updateCategorySchema.parse(input);
    await this.getCategory(userId, categoryId);

    if (validated.name !== undefined) {
      const duplicate = await prisma.category.findFirst({
        where: { userId, name: validated.name, NOT: { id: categoryId } },
      });
      if (duplicate) {
        throw new ApiError(409, 'CATEGORY_EXISTS', 'A category with this name already exists');
      }
    }

    return prisma.category.update({
      where: { id: categoryId },
      data: {
        name: validated.name,
        isDefault: validated.isDefault,
      },
    });
  }

  static async deleteCategory(userId: string, categoryId: string) {
    await this.getCategory(userId, categoryId);

    const [expenseCount, budgetCount] = await Promise.all([
      prisma.expense.count({ where: { categoryId } }),
      prisma.budget.count({ where: { categoryId } }),
    ]);

    if (expenseCount > 0 || budgetCount > 0) {
      throw new ApiError(
        409,
        'CATEGORY_IN_USE',
        `Category is referenced by ${expenseCount} expense(s) and ${budgetCount} budget(s); reassign or delete them first`,
      );
    }

    return prisma.category.delete({ where: { id: categoryId } });
  }

  static async listCategories(userId: string, options: CategoryListOptions) {
    const { pagination, sort } = options;
    const where: Prisma.CategoryWhereInput = { userId };

    if (options.filters.name) {
      where.name = { contains: options.filters.name, mode: 'insensitive' };
    }
    if (options.filters.isDefault !== undefined) {
      where.isDefault = options.filters.isDefault;
    }

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: buildOrderBy(sort),
      }),
      prisma.category.count({ where }),
    ]);

    return { items, total };
  }
}