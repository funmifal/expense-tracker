/**
 * Money utilities using integer minor units (cents).
 * Never use floating point arithmetic for authoritative financial calculations.
 */

export type MinorUnits = number;

/**
 * Converts formatted major unit string or number (e.g. 45.99) to integer minor units (4599 cents).
 */
export function toMinorUnits(majorUnits: number | string): MinorUnits {
  const num = typeof majorUnits === 'string' ? parseFloat(majorUnits) : majorUnits;
  if (isNaN(num)) throw new Error('Invalid major units amount');
  return Math.round(num * 100);
}

/**
 * Converts integer minor units (4599 cents) to major units (45.99).
 */
export function toMajorUnits(minorUnits: MinorUnits): number {
  if (!Number.isInteger(minorUnits)) {
    throw new Error('Minor units must be an integer');
  }
  return minorUnits / 100;
}

/**
 * Formats integer minor units to a formatted currency string (e.g. "$45.99").
 */
export function formatCurrency(minorUnits: MinorUnits, currency = 'USD'): string {
  const major = toMajorUnits(minorUnits);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(major);
}

/**
 * Integer minor units addition.
 */
export function addMoney(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a + b;
}

/**
 * Integer minor units subtraction.
 */
export function subtractMoney(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a - b;
}

/**
 * Calculates percentage usage deterministically (e.g. 45000 / 50000 = 90.0).
 */
export function calculatePercentage(spent: MinorUnits, budget: MinorUnits): number {
  if (budget <= 0) return 0;
  return Math.round((spent / budget) * 10000) / 100; // Returns rounded to 2 decimal places (e.g. 90.00)
}
