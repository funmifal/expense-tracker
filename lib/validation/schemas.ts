import { z } from 'zod';
import { DEFAULT_LIMIT, MAX_LIMIT } from '@/lib/api/pagination';

// ---------------------------------------------------------------------------
// Resource body schemas
// ---------------------------------------------------------------------------

export const registerUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  currency: z.string().length(3).default('USD'),
});

export const loginUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createExpenseSchema = z.object({
  amountMinorUnits: z.number().int().positive('Amount must be a positive integer in minor units (cents)'),
  currency: z.string().length(3).default('USD'),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  categoryId: z.string().min(1, 'Category is required'),
  paymentMethodId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const updateExpenseSchema = z.object({
  amountMinorUnits: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  date: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  categoryId: z.string().min(1).optional(),
  paymentMethodId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const createBudgetSchema = z.object({
  categoryId: z.string().optional().nullable(), // null = overall budget
  amountMinorUnits: z.number().int().positive('Budget amount must be positive'),
  periodStart: z.string().or(z.date()).transform((val) => {
    const d = new Date(val);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }),
});

export const updateBudgetSchema = z.object({
  amountMinorUnits: z.number().int().positive('Budget amount must be positive'),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  isDefault: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer').optional(),
  isDefault: z.boolean().optional(),
});

export const createPaymentMethodSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
});

export const updatePaymentMethodSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer').optional(),
});

// ---------------------------------------------------------------------------
// List query schemas (pagination, sorting, filtering) — shared + per-resource
// ---------------------------------------------------------------------------

export const CATEGORY_SORT_FIELDS = ['name', 'createdAt'] as const;
export const PAYMENT_METHOD_SORT_FIELDS = ['name', 'id'] as const;
export const EXPENSE_SORT_FIELDS = ['date', 'amountMinorUnits', 'createdAt'] as const;
export const BUDGET_SORT_FIELDS = ['periodStart', 'amountMinorUnits', 'createdAt'] as const;

/** Blank string query params are treated as absent. */
const blankToUndefined = (value: unknown) => (value === '' ? undefined : value);

/** limit: defaults to 20; upper-bounded (clamped) to MAX_LIMIT; must be an integer >= 1. */
const limitParam = z
  .preprocess(blankToUndefined, z.coerce.number().int('limit must be an integer').min(1, 'limit must be a positive integer'))
  .optional()
  .transform((value) => (value === undefined ? DEFAULT_LIMIT : Math.min(value, MAX_LIMIT)));

/** offset: defaults to 0; must be an integer >= 0. */
const offsetParam = z
  .preprocess(blankToUndefined, z.coerce.number().int('offset must be an integer').min(0, 'offset must be a non-negative integer'))
  .optional()
  .transform((value) => (value === undefined ? 0 : value));

/** sort: must be from the per-resource allow-list; never silently ignored. */
function sortParam(sortFields: readonly string[], defaultSort: string) {
  return z
    .preprocess(blankToUndefined, z.string().min(1))
    .optional()
    .refine((value) => value === undefined || sortFields.includes(value), {
      message: `sort must be one of: ${sortFields.join(', ')}`,
    })
    .transform((value) => value ?? defaultSort);
}

function orderParam(defaultOrder: 'asc' | 'desc' = 'asc') {
  return z
    .preprocess(blankToUndefined, z.enum(['asc', 'desc']))
    .optional()
    .transform((value) => value ?? defaultOrder);
}

const optionalStringParam = z.preprocess(blankToUndefined, z.string().min(1)).optional();

const booleanQueryParam = z
  .preprocess(
    blankToUndefined,
    z.enum(['true', 'false'], { errorMap: () => ({ message: 'must be "true" or "false"' }) }),
  )
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/** Optional integer filter; rejects non-integer values with a field-specific message. */
function intQueryParam(name: string) {
  return z
    .preprocess(blankToUndefined, z.string().min(1))
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      const num = Number(value);
      if (!Number.isInteger(num)) {
        ctx.addIssue({ code: 'custom', message: `${name} must be an integer` });
        return z.NEVER;
      }
      return num;
    });
}

/** Optional date filter; rejects unparseable values with a field-specific message. */
function dateQueryParam(name: string) {
  return z
    .preprocess(blankToUndefined, z.string().min(1))
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: 'custom', message: `${name} must be a valid date` });
        return z.NEVER;
      }
      return date;
    });
}

export const categoryListQuerySchema = z.object({
  name: optionalStringParam,
  isDefault: booleanQueryParam,
  limit: limitParam,
  offset: offsetParam,
  sort: sortParam(CATEGORY_SORT_FIELDS, 'name'),
  order: orderParam('asc'),
});

export const paymentMethodListQuerySchema = z.object({
  name: optionalStringParam,
  id: optionalStringParam,
  limit: limitParam,
  offset: offsetParam,
  sort: sortParam(PAYMENT_METHOD_SORT_FIELDS, 'name'),
  order: orderParam('asc'),
});

export const expenseListQuerySchema = z.object({
  categoryId: optionalStringParam,
  paymentMethodId: optionalStringParam,
  startDate: dateQueryParam('startDate'),
  endDate: dateQueryParam('endDate'),
  minAmount: intQueryParam('minAmount'),
  maxAmount: intQueryParam('maxAmount'),
  limit: limitParam,
  offset: offsetParam,
  sort: sortParam(EXPENSE_SORT_FIELDS, 'date'),
  order: orderParam('desc'),
});

export const budgetListQuerySchema = z.object({
  categoryId: optionalStringParam,
  periodStart: dateQueryParam('periodStart').transform((value) =>
    value ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)) : undefined,
  ),
  limit: limitParam,
  offset: offsetParam,
  sort: sortParam(BUDGET_SORT_FIELDS, 'periodStart'),
  order: orderParam('desc'),
});