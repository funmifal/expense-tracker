import { ListMeta } from './http';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Pagination {
  limit: number;
  offset: number;
}

export function buildMeta(total: number, { limit, offset }: Pagination): ListMeta {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

export type SortOrder = 'asc' | 'desc';

export interface Sort {
  field: string;
  order: SortOrder;
}