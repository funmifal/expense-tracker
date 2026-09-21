import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitConfig } from '@/config/rate-limit';
import { getBucket, setBucket } from '@/lib/rate-limit/bucket-store';
import { getClientIp } from '@/lib/rate-limit/client-ip';

export function middleware(request: NextRequest) {
  const { max, windowMs } = getRateLimitConfig();
  const now = Date.now();
  const key = getClientIp(request);

  const bucket = getBucket(key);
  let count = 1;
  let resetAt = now + windowMs;
  if (bucket && bucket.resetAt > now) {
    count = bucket.count + 1;
    resetAt = bucket.resetAt;
  }
  setBucket(key, { count, resetAt });

  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(Math.max(0, max - count)),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };

  if (count > max) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Retry after ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`,
        },
      },
      { status: 429, headers: { ...rateLimitHeaders, 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(rateLimitHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};