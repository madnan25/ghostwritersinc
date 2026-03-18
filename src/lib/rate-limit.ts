import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Use Upstash Redis when configured (serverless-safe), otherwise fall back to in-memory
const useUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Upstash rate limiters keyed by config string
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const key = `${maxRequests}:${windowMs}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      prefix: "rl",
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// --- In-memory fallback (single-process only) ---
interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

function inMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const retryAfter = Math.ceil(
      (entry.timestamps[0] + windowMs - now) / 1000
    );
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  entry.timestamps.push(now);
  return null;
}

/**
 * Sliding window rate limiter.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set (serverless-safe).
 * Falls back to in-memory for local development.
 */
export async function rateLimit(
  identifier: string,
  { maxRequests = 60, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): Promise<NextResponse | null> {
  if (useUpstash) {
    const limiter = getUpstashLimiter(maxRequests, windowMs);
    const result = await limiter.limit(identifier);
    if (!result.success) {
      const retryAfter = Math.ceil(
        (result.reset - Date.now()) / 1000
      );
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(retryAfter, 1)) },
        }
      );
    }
    return null;
  }

  return inMemoryRateLimit(identifier, maxRequests, windowMs);
}
