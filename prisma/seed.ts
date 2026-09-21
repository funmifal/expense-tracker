import { PrismaClient, PlanTier, AiSuggestionType, AiSuggestionStatus, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Deterministic Pseudo-Random Generator (Linear Congruential Generator)
function createRng(seed = 12345) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function main() {
  console.log('🌱 Starting idempotent seed...');

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const rng = createRng(42);

  // 1. Seed Users
  const userData = [
    { email: 'ada@example.com', passwordHash, currency: 'USD', planTier: PlanTier.FREE },
    { email: 'marcus@example.com', passwordHash, currency: 'USD', planTier: PlanTier.PAID },
    { email: 'demo@example.com', passwordHash, currency: 'USD', planTier: PlanTier.FREE },
  ];

  const users = [];
  for (const u of userData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { currency: u.currency, planTier: u.planTier },
      create: u,
    });
    users.push(user);
  }
  console.log(`✓ Seeded ${users.length} users.`);

  // 2. Default Categories per User
  const categoryNames = [
    { name: 'Housing', isDefault: true },
    { name: 'Groceries', isDefault: true },
    { name: 'Dining Out', isDefault: true },
    { name: 'Utilities', isDefault: true },
    { name: 'Transportation', isDefault: true },
    { name: 'Entertainment', isDefault: true },
    { name: 'Health', isDefault: true },
    { name: 'Shopping', isDefault: true },
    { name: 'Subscriptions', isDefault: true },
  ];

  const categoriesByUser: Record<string, any[]> = {};

  for (const user of users) {
    categoriesByUser[user.id] = [];
    for (const cat of categoryNames) {
      const category = await prisma.category.upsert({
        where: { userId_name: { userId: user.id, name: cat.name } },
        update: { isDefault: cat.isDefault },
        create: {
          userId: user.id,
          name: cat.name,
          isDefault: cat.isDefault,
        },
      });
      categoriesByUser[user.id].push(category);
    }
  }
  console.log('✓ Seeded default categories for each user.');

  // 3. Payment Methods per User
  const paymentMethodNames = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer'];
  const paymentMethodsByUser: Record<string, any[]> = {};

  for (const user of users) {
    paymentMethodsByUser[user.id] = [];
    for (const pmName of paymentMethodNames) {
      const pm = await prisma.paymentMethod.upsert({
        where: { userId_name: { userId: user.id, name: pmName } },
        update: {},
        create: {
          userId: user.id,
          name: pmName,
        },
      });
      paymentMethodsByUser[user.id].push(pm);
    }
  }
  console.log('✓ Seeded payment methods for each user.');

  // 4. Budgets and Snapshots per User
  const now = new Date();
  const currentPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prev2PeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));

  const periods = [prev2PeriodStart, prevPeriodStart, currentPeriodStart];

  for (const user of users) {
    const userCats = categoriesByUser[user.id];

    for (const periodStart of periods) {
      // Overall budget (categoryId null)
      const overallBudget = await prisma.budget.upsert({
        where: {
          userId_categoryId_periodStart: {
            userId: user.id,
            categoryId: '', // Dummy string fallback for null key handling if needed or query existing
          } as any,
        },
        update: { amountMinorUnits: 250000 }, // $2,500.00
        create: {
          userId: user.id,
          categoryId: null,
          amountMinorUnits: 250000,
          periodStart,
        },
      }).catch(async () => {
        // Find or create overall budget safely
        const existing = await prisma.budget.findFirst({
          where: { userId: user.id, categoryId: null, periodStart },
        });
        if (existing) return existing;
        return prisma.budget.create({
          data: {
            userId: user.id,
            categoryId: null,
            amountMinorUnits: 250000,
            periodStart,
          },
        });
      });

      // Category budgets for Groceries ($600) and Dining Out ($300)
      const groceriesCat = userCats.find(c => c.name === 'Groceries');
      if (groceriesCat) {
        await prisma.budget.upsert({
          where: {
            userId_categoryId_periodStart: {
              userId: user.id,
              categoryId: groceriesCat.id,
              periodStart,
            },
          },
          update: { amountMinorUnits: 60000 },
          create: {
            userId: user.id,
            categoryId: groceriesCat.id,
            amountMinorUnits: 60000,
            periodStart,
          },
        });
      }

      const diningCat = userCats.find(c => c.name === 'Dining Out');
      if (diningCat) {
        await prisma.budget.upsert({
          where: {
            userId_categoryId_periodStart: {
              userId: user.id,
              categoryId: diningCat.id,
              periodStart,
            },
          },
          update: { amountMinorUnits: 30000 },
          create: {
            userId: user.id,
            categoryId: diningCat.id,
            amountMinorUnits: 30000,
            periodStart,
          },
        });
      }

      // Create snapshot for closed past periods
      if (periodStart < currentPeriodStart && overallBudget) {
        const snapshotExists = await prisma.budgetPeriodSnapshot.findFirst({
          where: { userId: user.id, budgetId: overallBudget.id, periodStart },
        });
        if (!snapshotExists) {
          await prisma.budgetPeriodSnapshot.create({
            data: {
              budgetId: overallBudget.id,
              userId: user.id,
              categoryId: null,
              periodStart,
              budgetAmountMinorUnits: 250000,
              spentMinorUnits: 215000,
              closedAt: new Date(periodStart.valueOf() + 28 * 86400 * 1000),
            },
          });
        }
      }
    }
  }
  console.log('✓ Seeded budgets and budget snapshots.');

  // 5. Realistic Expenses per User (Deterministic)
  const expenseDescriptions: Record<string, string[]> = {
    Housing: ['Monthly Rent', 'Security Deposit', 'Home Insurance'],
    Groceries: ['Trader Joe\'s Grocery Run', 'Whole Foods Market', 'Safeway Restock', 'Local Farmers Market'],
    'Dining Out': ['Chipotle Burrito Bowl', 'Starbucks Latte & Muffin', 'Sushi Dinner with Friends', 'Pizzeria Slice'],
    Utilities: ['Electric Bill', 'Water & Sewer', 'High Speed Internet', 'Mobile Phone Service'],
    Transportation: ['Uber Ride to Campus', 'Gas Station Refill', 'Monthly Subway Pass', 'Parking Meter'],
    Entertainment: ['Cinema Movie Ticket', 'Concert Pass', 'Bowling Night'],
    Health: ['CVS Pharmacy Prescription', 'Gym Membership', 'Doctor Co-pay'],
    Shopping: ['Target Home Goods', 'Amazon Electronics Order', 'Clothing Store Purchase'],
    Subscriptions: ['Netflix Premium', 'Spotify Family Plan', 'iCloud Storage Upgrade', 'GitHub Copilot Subscription'],
  };

  let totalExpensesCreated = 0;

  for (const user of users) {
    const userCats = categoriesByUser[user.id];
    const userPms = paymentMethodsByUser[user.id];

    // Check existing expenses count for idempotency
    const existingCount = await prisma.expense.count({ where: { userId: user.id } });
    if (existingCount >= 100) {
      console.log(`- User ${user.email} already has ${existingCount} expenses, skipping expense generation.`);
      continue;
    }

    // Generate ~100 expenses per user spanning past 90 days
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const numExpenses = Math.floor(rng() * 3) + 1; // 1 to 3 expenses per day

      for (let i = 0; i < numExpenses; i++) {
        const cat = userCats[Math.floor(rng() * userCats.length)];
        const pm = userPms[Math.floor(rng() * userPms.length)];
        const descriptions = expenseDescriptions[cat.name] || ['General Expense'];
        const description = descriptions[Math.floor(rng() * descriptions.length)];

        // Amount between $5.00 (500 cents) and $250.00 (25000 cents)
        const amountMinorUnits = Math.floor(rng() * 24500) + 500;
        const date = new Date(Date.now() - (dayOffset * 86400 * 1000 + Math.floor(rng() * 3600 * 12 * 1000)));

        const isDeleted = rng() < 0.05; // 5% soft deleted
        const deletedAt = isDeleted ? new Date(date.valueOf() + 86400 * 1000) : null;

        const expense = await prisma.expense.create({
          data: {
            userId: user.id,
            amountMinorUnits,
            currency: user.currency,
            date,
            categoryId: cat.id,
            paymentMethodId: pm.id,
            description,
            isDeleted,
            deletedAt,
          },
        });
        totalExpensesCreated++;

        // Add history for 10% of expenses (edited expenses audit trail)
        if (rng() < 0.10) {
          await prisma.expenseHistory.create({
            data: {
              expenseId: expense.id,
              changedAt: new Date(expense.createdAt.valueOf() + 3600 * 1000),
              changedBy: user.id,
              fieldName: 'amountMinorUnits',
              oldValue: (amountMinorUnits - 500).toString(),
              newValue: amountMinorUnits.toString(),
            },
          });
        }
      }
    }
  }
  console.log(`✓ Seeded realistic expenses (${totalExpensesCreated} newly created).`);

  // 6. Print Row Counts Verification Table
  console.log('\n==================================================');
  console.log(' SEED VERIFICATION ROW COUNTS');
  console.log('==================================================');
  console.log(` Users                  : ${await prisma.user.count()}`);
  console.log(` Categories             : ${await prisma.category.count()}`);
  console.log(` Payment Methods        : ${await prisma.paymentMethod.count()}`);
  console.log(` Budgets                : ${await prisma.budget.count()}`);
  console.log(` Budget Period Snapshots: ${await prisma.budgetPeriodSnapshot.count()}`);
  console.log(` Expenses               : ${await prisma.expense.count()}`);
  console.log(` Expense Histories      : ${await prisma.expenseHistory.count()}`);
  console.log(` Sessions               : ${await prisma.session.count()}`);
  console.log(` AI Suggestions         : ${await prisma.aiSuggestion.count()}`);
  console.log(` Notifications          : ${await prisma.notification.count()}`);
  console.log('==================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
