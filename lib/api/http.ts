import { NextResponse } from 'next/server';

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function okList<T>(data: T[], meta: ListMeta, status = 200): NextResponse {
  return NextResponse.json({ data, meta }, { status });
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: ValidationIssue[],
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}