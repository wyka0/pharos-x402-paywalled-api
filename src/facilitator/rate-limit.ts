export interface RateLimitDecision {
  allowed: boolean;
  /**
   * Whole seconds until the current window resets. Zero when the request is
   * allowed; at least 1 when it is rejected.
   */
  retryAfterSeconds: number;
}

/**
 * Fixed-window, per-key limiter for a single process.
 *
 * Scope and limitations:
 * - Buckets live in memory and reset when the process restarts.
 * - Counts are not shared across replicas. The deployment keeps exactly one
 *   facilitator replica until the settlement ledger has shared storage.
 * - A fixed window can allow up to twice the configured limit across a window
 *   boundary. The defaults are deliberately conservative for a testnet demo.
 * - Per-IP limits can be diluted by NAT (many users share a key) or evaded by
 *   rotating IPv6 addresses / many distinct IPs. A shared edge limiter is the
 *   right tool for broad public exposure.
 *
 * This limiter is an abuse brake, not a security boundary. EIP-3009 signature,
 * recipient, amount, nonce, and replay checks remain in the facilitator scheme.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweepAt: number;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Rate limit must be a positive integer");
    }
    if (!Number.isInteger(windowMs) || windowMs < 1) {
      throw new Error("Rate-limit window must be a positive integer");
    }
    this.lastSweepAt = now();
  }

  check(key: string): RateLimitDecision {
    const now = this.now();
    this.sweepIfDue(now);

    const bucket = this.buckets.get(key);
    if (bucket === undefined || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= this.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
      };
    }
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Visible for tests; the map is swept at most once per window. */
  get size(): number {
    return this.buckets.size;
  }

  private sweepIfDue(now: number): void {
    if (now - this.lastSweepAt < this.windowMs) {
      return;
    }
    this.lastSweepAt = now;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
