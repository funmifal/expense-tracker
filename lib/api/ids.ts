import { ApiError } from './errors';

const ID_PATTERN = /^[a-z0-9_]{8,64}$/i;

export function parseId(raw: string): string {
  if (!ID_PATTERN.test(raw)) {
    throw new ApiError(
      400,
      'INVALID_ID',
      `Identifier "${raw}" is malformed: expected a generated id (cuid or seed)`,
    );
  }
  return raw;
}