import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { BudgetService } from '@/lib/budgets/budget-service';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('periodStart') || new Date().toISOString();
    const periodStartDate = new Date(dateParam);
    const periodStart = new Date(Date.UTC(periodStartDate.getUTCFullYear(), periodStartDate.getUTCMonth(), 1));

    const usage = await BudgetService.getBudgetUsage(user.id, periodStart);
    return NextResponse.json({ data: usage }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const budget = await BudgetService.createBudget(user.id, body);
    return NextResponse.json({ data: budget }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
