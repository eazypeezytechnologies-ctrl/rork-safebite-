import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_KEY = '@safebite_rate_limit_state';

interface RequestRecord {
  url: string;
  timestamp: number;
  count: number;
}

interface ThrottleState {
  requests: RequestRecord[];
  isThrottled: boolean;
  throttleUntil: number;
  retryAfter: number;
}

class RequestThrottler {
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private requestCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private lastRequestTime: Map<string, number> = new Map();
  private globalThrottleUntil: number = 0;
  private consecutiveErrors: number = 0;
  
  private readonly MAX_REQUESTS_PER_MINUTE = 30;
  private readonly MIN_REQUEST_INTERVAL_MS = 100;
  private readonly THROTTLE_WINDOW_MS = 60000;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly BASE_BACKOFF_MS = 2000;
  private readonly MAX_BACKOFF_MS = 60000;

  constructor() {
    this.loadState();
  }

  private async loadState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      if (stored) {
        const state = JSON.parse(stored) as ThrottleState;
        if (state.throttleUntil > Date.now()) {
          this.globalThrottleUntil = state.throttleUntil;
          console.log('[RequestThrottler] Restored throttle state, throttled until:', new Date(this.globalThrottleUntil).toISOString());
        }
      }
    } catch {
      // Ignore errors loading state
    }
  }

  private async saveState(): Promise<void> {
    try {
      const state: ThrottleState = {
        requests: [],
        isThrottled: this.globalThrottleUntil > Date.now(),
        throttleUntil: this.globalThrottleUntil,
        retryAfter: Math.max(0, this.globalThrottleUntil - Date.now()),
      };
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
    } catch {
      // Ignore errors saving state
    }
  }

  private getRequestKey(url: string, method: string = 'GET'): string {
    try {
      const urlObj = new URL(url);
      return `${method}:${urlObj.pathname}`;
    } catch {
      return `${method}:${url}`;
    }
  }

  private cleanOldRecords(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (record.resetAt < now) {
        this.requestCounts.delete(key);
      }
    }
  }

  isThrottled(): boolean {
    return Date.now() < this.globalThrottleUntil;
  }

  getRetryAfterMs(): number {
    return Math.max(0, this.globalThrottleUntil - Date.now());
  }

  getRetryAfterSeconds(): number {
    return Math.ceil(this.getRetryAfterMs() / 1000);
  }

  recordError(is429: boolean = false): void {
    this.consecutiveErrors++;
    
    if (is429 || this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
      const backoffMs = Math.min(
        this.BASE_BACKOFF_MS * Math.pow(2, Math.min(this.consecutiveErrors, 6)),
        this.MAX_BACKOFF_MS
      );
      
      const jitter = Math.random() * 1000;
      this.globalThrottleUntil = Date.now() + backoffMs + jitter;
      
      console.log(`[RequestThrottler] Throttling for ${Math.round((backoffMs + jitter) / 1000)}s due to ${is429 ? '429 error' : 'consecutive errors'}`);
      this.saveState();
    }
  }

  recordSuccess(): void {
    this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
  }

  resetThrottle(): void {
    this.globalThrottleUntil = 0;
    this.consecutiveErrors = 0;
    this.saveState();
    console.log('[RequestThrottler] Throttle reset');
  }

  async shouldThrottle(url: string, method: string = 'GET'): Promise<{ shouldWait: boolean; waitMs: number; reason?: string }> {
    this.cleanOldRecords();
    
    if (this.isThrottled()) {
      const waitMs = this.getRetryAfterMs();
      return { shouldWait: true, waitMs, reason: 'Global throttle active' };
    }

    const key = this.getRequestKey(url, method);
    const now = Date.now();

    const lastTime = this.lastRequestTime.get(key) || 0;
    const timeSinceLastRequest = now - lastTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
      const waitMs = this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      return { shouldWait: true, waitMs, reason: 'Min interval not met' };
    }

    let record = this.requestCounts.get(key);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + this.THROTTLE_WINDOW_MS };
      this.requestCounts.set(key, record);
    }

    if (record.count >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitMs = record.resetAt - now;
      return { shouldWait: true, waitMs, reason: 'Rate limit exceeded' };
    }

    return { shouldWait: false, waitMs: 0 };
  }

  recordRequest(url: string, method: string = 'GET'): void {
    const key = this.getRequestKey(url, method);
    const now = Date.now();
    
    this.lastRequestTime.set(key, now);
    
    let record = this.requestCounts.get(key);
    if (!record || record.resetAt < now) {
      record = { count: 1, resetAt: now + this.THROTTLE_WINDOW_MS };
    } else {
      record.count++;
    }
    this.requestCounts.set(key, record);
  }

  async dedupeRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttlMs: number = 5000
  ): Promise<T> {
    const cacheKey = `dedupe:${key}`;
    
    const existing = this.pendingRequests.get(cacheKey);
    if (existing) {
      console.log(`[RequestThrottler] Deduplicating request: ${key}`);
      return existing;
    }

    const promise = requestFn().finally(() => {
      setTimeout(() => {
        this.pendingRequests.delete(cacheKey);
      }, ttlMs);
    });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  async throttledFetch<T>(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const { timeout = 15000, ...fetchOptions } = options;

    const throttleCheck = await this.shouldThrottle(url, method);
    if (throttleCheck.shouldWait) {
      console.log(`[RequestThrottler] Waiting ${throttleCheck.waitMs}ms before request: ${throttleCheck.reason}`);
      
      if (throttleCheck.waitMs > 5000) {
        throw new ThrottleError(
          `Too many requests. Please wait ${Math.ceil(throttleCheck.waitMs / 1000)} seconds.`,
          throttleCheck.waitMs
        );
      }
      
      await this.sleep(throttleCheck.waitMs);
    }

    this.recordRequest(url, method);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 30000;
        this.globalThrottleUntil = Date.now() + waitMs;
        this.saveState();
        this.recordError(true);
        
        throw new ThrottleError(
          `Rate limited. Please wait ${Math.ceil(waitMs / 1000)} seconds.`,
          waitMs
        );
      }

      if (!response.ok) {
        this.recordError(false);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.recordSuccess();

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return response as unknown as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error?.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      
      if (!(error instanceof ThrottleError)) {
        this.recordError(false);
      }
      
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ThrottleError extends Error {
  public readonly retryAfterMs: number;
  
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'ThrottleError';
    this.retryAfterMs = retryAfterMs;
  }
}

export const requestThrottler = new RequestThrottler();

export function useThrottleState() {
  const isThrottled = requestThrottler.isThrottled();
  const retryAfterSeconds = requestThrottler.getRetryAfterSeconds();
  
  return {
    isThrottled,
    retryAfterSeconds,
    resetThrottle: () => requestThrottler.resetThrottle(),
  };
}
