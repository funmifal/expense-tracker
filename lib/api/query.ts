import { z } from 'zod';
import { ApiError } from './errors';

export function parseQuery<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  searchParams: URLSearchParams,
): z.infer<TSchema> {
  const result = schema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'query',
      message: issue.message,
    }));
    const message = details.map((issue) => `${issue.field}: ${issue.message}`).join('; ');
    throw new ApiError(400, 'INVALID_QUERY', message, details);
  }
  return result.data;
}