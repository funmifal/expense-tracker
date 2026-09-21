import { z } from 'zod';

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

export const filterExpensesSchema = z.object({
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  categoryId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  minAmount: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  maxAmount: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
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
