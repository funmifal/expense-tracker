import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { fail, ok, okList } from '@/lib/api/http';
import { buildMeta } from '@/lib/api/pagination';
import { parseQuery } from '@/lib/api/query';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { ExpenseService } from '@/lib/expenses/expense-service';
import { expenseListQuerySchema } from '@/lib/validation/schemas';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const query = parseQuery(expenseListQuerySchema, new URL(req.url).searchParams);

    const { items, total } = await ExpenseService.listExpenses(user.id, {
      filters: {
        startDate: query.startDate,
        endDate: query.endDate,
        categoryId: query.categoryId,
        paymentMethodId: query.paymentMethodId,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
      },
      pagination: { limit: query.limit, offset: query.offset },
      sort: { field: query.sort, order: query.order },
    });

    return okList(items, buildMeta(total, { limit: query.limit, offset: query.offset }));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const body = await req.json();
    const expense = await ExpenseService.createExpense(user.id, body);
    return ok(expense, 201);
  } catch (error) {
    return handleError(error);
  }
}