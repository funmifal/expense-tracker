import { ZodError } from 'zod';
import { fail, ValidationIssue } from './http';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ValidationIssue[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function zodIssues(error: ZodError): ValidationIssue[] {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}

export function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    const issues = zodIssues(error);
    const message = issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ');
    return fail(422, 'VALIDATION_ERROR', message, issues);
  }

  if (error instanceof SyntaxError) {
    return fail(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }

  console.error('Unhandled API error:', error);
  return fail(500, 'INTERNAL_ERROR', 'Internal server error');
}