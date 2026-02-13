interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  actionName: string;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'invite.redeem': { maxRequests: 5, windowMs: 300000, actionName: 'Accept invite' },
  'invite.create': { maxRequests: 10, windowMs: 600000, actionName: 'Create invite' },
  'barcode.lookup': { maxRequests: 30, windowMs: 60000, actionName: 'Barcode lookup' },
  'ocr.analyze': { maxRequests: 10, windowMs: 300000, actionName: 'Photo analysis' },
  'auth.login': { maxRequests: 5, windowMs: 300000, actionName: 'Login' },
  'auth.signup': { maxRequests: 3, windowMs: 600000, actionName: 'Sign up' },
  'profile.create': { maxRequests: 10, windowMs: 600000, actionName: 'Create profile' },
  'family.create': { maxRequests: 5, windowMs: 600000, actionName: 'Create family' },
  'search.query': { maxRequests: 30, windowMs: 60000, actionName: 'Search' },
};

class ActionRateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();

  check(action: string): { allowed: boolean; retryAfterMs: number; message: string } {
    const config = RATE_LIMITS[action];
    if (!config) {
      return { allowed: true, retryAfterMs: 0, message: '' };
    }

    const key = action;
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now - entry.windowStart > config.windowMs) {
      this.entries.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterMs: 0, message: '' };
    }

    if (entry.count >= config.maxRequests) {
      const retryAfterMs = config.windowMs - (now - entry.windowStart);
      const retrySeconds = Math.ceil(retryAfterMs / 1000);
      return {
        allowed: false,
        retryAfterMs,
        message: `Too many ${config.actionName.toLowerCase()} attempts. Please wait ${retrySeconds} seconds.`,
      };
    }

    entry.count++;
    return { allowed: true, retryAfterMs: 0, message: '' };
  }

  record(action: string): void {
    const config = RATE_LIMITS[action];
    if (!config) return;

    const now = Date.now();
    const entry = this.entries.get(action);

    if (!entry || now - entry.windowStart > config.windowMs) {
      this.entries.set(action, { count: 1, windowStart: now });
    } else {
      entry.count++;
    }
  }

  reset(action?: string): void {
    if (action) {
      this.entries.delete(action);
    } else {
      this.entries.clear();
    }
  }

  getStatus(action: string): { remaining: number; resetInMs: number } {
    const config = RATE_LIMITS[action];
    if (!config) return { remaining: 999, resetInMs: 0 };

    const entry = this.entries.get(action);
    if (!entry) return { remaining: config.maxRequests, resetInMs: 0 };

    const now = Date.now();
    if (now - entry.windowStart > config.windowMs) {
      return { remaining: config.maxRequests, resetInMs: 0 };
    }

    return {
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetInMs: config.windowMs - (now - entry.windowStart),
    };
  }
}

export const actionRateLimiter = new ActionRateLimiter();
