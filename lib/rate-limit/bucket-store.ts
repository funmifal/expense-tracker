export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export function getBucket(key: string): RateLimitBucket | undefined {
  return buckets.get(key);
}

export function setBucket(key: string, bucket: RateLimitBucket): void {
  buckets.set(key, bucket);
}