export const RATE_LIMIT_DEFAULT_MAX = 100;
export const RATE_LIMIT_DEFAULT_WINDOW_MS = 60_000;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return fallback;
  return value;
}

export function getRateLimitConfig() {
  return {
    max: readPositiveInt(process.env.RATE_LIMIT_MAX, RATE_LIMIT_DEFAULT_MAX),
    windowMs: readPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, RATE_LIMIT_DEFAULT_WINDOW_MS),
  };
}