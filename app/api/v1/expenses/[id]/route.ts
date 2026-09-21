import { NextRequest } from 'next/server';
import { handleError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/http';
import { parseId } from '@/lib/api/ids';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { ExpenseService } from '@/lib/expenses/expense-service';

interface RouteContext {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }
    const id = parseId(params.id);
    const expense = await ExpenseService.getExpense(user.id, id);
    return ok(expense);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const id = parseId(params.id);
    const body = await req.json();
    const expense = await ExpenseService.updateExpense(user.id, id, body);
    return ok(expense);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const id = parseId(params.id);
    const expense = await ExpenseService.softDeleteExpense(user.id, id);
    return ok(expense);
  } catch (error) {
    return handleError(error);
  }
}