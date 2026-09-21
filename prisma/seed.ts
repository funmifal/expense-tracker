import { PrismaClient, Prisma, PlanTier } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED = 20260921;
const USER_COUNT = 300;
const EXPENSES_PER_USER = 20;
const CLOSED_PERIODS = 2;
const BATCH_SIZE = 500;

const DEFAULT_CATEGORIES = [
  'Housing',
  'Groceries',
  'Dining Out',
  'Utilities',
  'Transportation',
  'Entertainment',
  'Health',
  'Shopping',
  'Subscriptions',
] as const;

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer'] as const;

const DESCRIPTIONS: Record<string, string[]> = {
  Housing: ['Monthly Rent', 'Security Deposit', 'Home Insurance'],
  Groceries: ["Trader Joe's Grocery Run", 'Whole Foods Market', 'Safeway Restock', 'Local Farmers Market'],
  'Dining Out': ['Chipotle Burrito Bowl', 'Starbucks Latte & Muffin', 'Sushi Dinner', 'Pizzeria Slice'],
  Utilities: ['Electric Bill', 'Water & Sewer', 'High Speed Internet', 'Mobile Phone Service'],
  Transportation: ['Uber Ride', 'Gas Station Refill', 'Monthly Subway Pass', 'Parking Meter'],
  Entertainment: ['Cinema Ticket', 'Concert Pass', 'Bowling Night'],
  Health: ['Pharmacy Prescription', 'Gym Membership', 'Doctor Co-pay'],
  Shopping: ['Target Home Goods', 'Amazon Order', 'Clothing Store Purchase'],
  Subscriptions: ['Netflix Premium', 'Spotify Family Plan', 'iCloud Storage', 'GitHub Copilot'],
};

function seedId(...parts: Array<string | number>): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex');
  return `seed_${hash.slice(0, 24)}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

async function insertMany<T>(model: { createMany: (args: { data: T[]; skipDuplicates: boolean }) => Promise<{ count: number }> }, rows: T[]): Promise<number> {
  let inserted = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const result = await model.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }
  return inserted;
}

async function main() {
  faker.seed(SEED);

  const passwordHash = bcrypt.hashSync('Password123!', 10);
  const now = new Date();
  const currentPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStarts = Array.from({ length: CLOSED_PERIODS + 1 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)),
  );

  const userRows: Prisma.UserCreateManyInput[] = [];
  const categoryRows: Prisma.CategoryCreateManyInput[] = [];
  const paymentMethodRows: Prisma.PaymentMethodCreateManyInput[] = [];
  const budgetRows: Prisma.BudgetCreateManyInput[] = [];
  const expenseRows: Prisma.ExpenseCreateManyInput[] = [];
  const historyRows: Prisma.ExpenseHistoryCreateManyInput[] = [];
  const snapshotRows: Prisma.BudgetPeriodSnapshotCreateManyInput[] = [];

  for (let userIndex = 0; userIndex < USER_COUNT; userIndex++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const userId = seedId('user', userIndex);
    const currency = 'USD';
    const planTier = userIndex % 5 === 0 ? PlanTier.PAID : PlanTier.FREE;

    userRows.push({
      id: userId,
      email: `${slug(firstName)}.${slug(lastName)}.${userIndex}@example.com`,
      passwordHash,
      currency,
      planTier,
    });

    const userCategories = DEFAULT_CATEGORIES.map((name) => ({
      id: seedId('category', userId, name),
      name,
    }));
    for (const category of userCategories) {
      categoryRows.push({ id: category.id, userId, name: category.name, isDefault: true });
    }

    const userPaymentMethods = PAYMENT_METHODS.map((name) => ({
      id: seedId('paymentMethod', userId, name),
      name,
    }));
    for (const paymentMethod of userPaymentMethods) {
      paymentMethodRows.push({ id: paymentMethod.id, userId, name: paymentMethod.name });
    }

    const budgetedCategories = userCategories.slice(0, 2);
    for (const periodStart of periodStarts) {
      const overallBudgetId = seedId('budget', userId, 'overall', periodStart.toISOString());
      const overallAmount = faker.number.int({ min: 150000, max: 400000 });
      budgetRows.push({
        id: overallBudgetId,
        userId,
        categoryId: null,
        amountMinorUnits: overallAmount,
        periodStart,
      });

      if (periodStart < currentPeriodStart) {
        snapshotRows.push({
          id: seedId('snapshot', overallBudgetId),
          budgetId: overallBudgetId,
          userId,
          categoryId: null,
          periodStart,
          budgetAmountMinorUnits: overallAmount,
          spentMinorUnits: faker.number.int({ min: 50000, max: 420000 }),
          closedAt: new Date(periodStart.valueOf() + 28 * 86400 * 1000),
        });
      }

      for (const category of budgetedCategories) {
        budgetRows.push({
          id: seedId('budget', userId, category.id, periodStart.toISOString()),
          userId,
          categoryId: category.id,
          amountMinorUnits: faker.number.int({ min: 30000, max: 120000 }),
          periodStart,
        });
      }
    }

    for (let expenseIndex = 0; expenseIndex < EXPENSES_PER_USER; expenseIndex++) {
      const category = faker.helpers.arrayElement(userCategories);
      const paymentMethod = faker.helpers.arrayElement(userPaymentMethods);
      const expenseId = seedId('expense', userId, expenseIndex);
      const amountMinorUnits = faker.number.int({ min: 500, max: 25000 });
      const daysAgo = faker.number.int({ min: 0, max: 89 });
      const date = new Date(
        now.valueOf() - daysAgo * 86400 * 1000 - faker.number.int({ min: 0, max: 43200 * 1000 }),
      );
      const isDeleted = faker.number.float({ min: 0, max: 1 }) < 0.05;
      const descriptions = DESCRIPTIONS[category.name] ?? ['General Expense'];

      expenseRows.push({
        id: expenseId,
        userId,
        amountMinorUnits,
        currency,
        date,
        categoryId: category.id,
        paymentMethodId: paymentMethod.id,
        description: faker.helpers.arrayElement(descriptions),
        isDeleted,
        deletedAt: isDeleted ? new Date(date.valueOf() + 86400 * 1000) : null,
      });

      if (faker.number.float({ min: 0, max: 1 }) < 0.1) {
        historyRows.push({
          id: seedId('history', expenseId),
          expenseId,
          changedAt: new Date(date.valueOf() + 3600 * 1000),
          changedBy: userId,
          fieldName: 'amountMinorUnits',
          oldValue: String(Math.max(100, amountMinorUnits - 500)),
          newValue: String(amountMinorUnits),
        });
      }
    }
  }

  const inserted = {
    users: await insertMany(prisma.user, userRows),
    categories: await insertMany(prisma.category, categoryRows),
    paymentMethods: await insertMany(prisma.paymentMethod, paymentMethodRows),
    budgets: await insertMany(prisma.budget, budgetRows),
    expenses: await insertMany(prisma.expense, expenseRows),
    expenseHistories: await insertMany(prisma.expenseHistory, historyRows),
    budgetSnapshots: await insertMany(prisma.budgetPeriodSnapshot, snapshotRows),
  };

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    paymentMethods: await prisma.paymentMethod.count(),
    budgets: await prisma.budget.count(),
    expenses: await prisma.expense.count(),
    expenseHistories: await prisma.expenseHistory.count(),
    budgetSnapshots: await prisma.budgetPeriodSnapshot.count(),
  };

  const [crossUserExpenses] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Expense" e
    JOIN "Category" c ON c.id = e."categoryId"
    WHERE c."userId" <> e."userId"`;
  const [crossUserPaymentMethods] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Expense" e
    JOIN "PaymentMethod" p ON p.id = e."paymentMethodId"
    WHERE p."userId" <> e."userId"`;
  const [orphanExpenses] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Expense" e
    LEFT JOIN "Category" c ON c.id = e."categoryId"
    WHERE c.id IS NULL`;
  const [orphanHistories] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM "ExpenseHistory" h
    LEFT JOIN "Expense" e ON e.id = h."expenseId"
    WHERE e.id IS NULL`;

  console.log('Inserted this run:');
  for (const [key, value] of Object.entries(inserted)) console.log(`  ${key.padEnd(18)} ${value}`);
  console.log('Total rows in database:');
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key.padEnd(18)} ${value}`);
  console.log('Relationship integrity:');
  console.log(`  cross-user expense/category      ${crossUserExpenses.count}`);
  console.log(`  cross-user expense/paymentMethod ${crossUserPaymentMethods.count}`);
  console.log(`  orphan expenses                  ${orphanExpenses.count}`);
  console.log(`  orphan expense histories         ${orphanHistories.count}`);

  const invalid =
    crossUserExpenses.count + crossUserPaymentMethods.count + orphanExpenses.count + orphanHistories.count;
  if (invalid > 0) {
    throw new Error(`Relationship integrity check failed: ${invalid} invalid reference(s)`);
  }
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
