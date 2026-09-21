import { NextRequest } from 'next/server';

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor && forwardedFor.trim() !== '') {
    return forwardedFor.split(',')[0].trim();
  }
  return request.ip ?? 'unknown';
}