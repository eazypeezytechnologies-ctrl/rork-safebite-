

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitorWindow: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface SafeFetchOptions extends RequestInit {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  skipCircuitBreaker?: boolean;
}

export interface ErrorRecord {
  timestamp: number;
  url: string;
  error: string;
  statusCode?: number;
}

class ErrorCounter {
  private errors: ErrorRecord[] = [];
  private readonly windowMs: number;

  constructor(windowMs: number = 10 * 60 * 1000) {
    this.windowMs = windowMs;
  }

  recordError(url: string, error: Error | string, statusCode?: number): void {
    const errorRecord: ErrorRecord = {
      timestamp: Date.now(),
      url,
      error: error instanceof Error ? error.message : error,
      statusCode,
    };
    
    this.errors.push(errorRecord);
    this.cleanOldErrors();
    
    console.error('[ErrorCounter] Recorded error:', errorRecord);
  }

  getErrorCount(code?: number): number {
    this.cleanOldErrors();
    if (code) {
      return this.errors.filter(e => e.statusCode === code).length;
    }
    return this.errors.length;
  }

  getErrorsByStatusCode(code: number): ErrorRecord[] {
    this.cleanOldErrors();
    return this.errors.filter(e => e.statusCode === code);
  }

  getRecentErrors(limit: number = 10): ErrorRecord[] {
    this.cleanOldErrors();
    return [...this.errors].reverse().slice(0, limit);
  }

  getAllErrors(): ErrorRecord[] {
    this.cleanOldErrors();
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
    console.log('[ErrorCounter] Cleared all errors');
  }

  private cleanOldErrors(): void {
    const cutoff = Date.now() - this.windowMs;
    const before = this.errors.length;
    this.errors = this.errors.filter(e => e.timestamp >= cutoff);
    const after = this.errors.length;
    
    if (before !== after) {
      console.log(`[ErrorCounter] Cleaned ${before - after} old errors`);
    }
  }
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;
  private errorCounter: ErrorCounter;

  constructor(config: CircuitBreakerConfig, errorCounter: ErrorCounter) {
    this.config = config;
    this.errorCounter = errorCounter;
  }

  async execute<T>(fn: () => Promise<T>, url: string): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        console.log('[CircuitBreaker] Attempting to close circuit (half-open state)');
        this.state = CircuitState.HALF_OPEN;
      } else {
        const error = new Error('Circuit breaker is OPEN');
        this.errorCounter.recordError(url, error, 503);
        throw error;
      }
    }

    try {
      const result = await fn();
      
      if (this.state === CircuitState.HALF_OPEN) {
        console.log('[CircuitBreaker] Request succeeded in half-open state, closing circuit');
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.recordFailure(url, error as Error);
      throw error;
    }
  }

  private recordFailure(url: string, error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    console.log(`[CircuitBreaker] Failure count: ${this.failureCount}/${this.config.failureThreshold}`);

    const recentErrorsCount = this.errorCounter.getErrorCount();
    
    if (recentErrorsCount >= this.config.failureThreshold) {
      console.error(`[CircuitBreaker] OPENING circuit - ${recentErrorsCount} errors in ${this.config.monitorWindow}ms window`);
      this.state = CircuitState.OPEN;
      this.failureCount = 0;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    console.log('[CircuitBreaker] Manual reset');
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 1,
  initialDelay: 500,
  maxDelay: 3000,
  backoffFactor: 2,
};

const defaultCircuitConfig: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeout: 60000,
  monitorWindow: 10 * 60 * 1000,
};

export const globalErrorCounter = new ErrorCounter(defaultCircuitConfig.monitorWindow);
const globalCircuitBreaker = new CircuitBreaker(defaultCircuitConfig, globalErrorCounter);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function safeFetch<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<T> {
  const {
    timeout = 10000,
    retryConfig = {},
    skipCircuitBreaker = false,
    ...fetchOptions
  } = options;

  const config: RetryConfig = { ...defaultRetryConfig, ...retryConfig };

  const fetchWithTimeout = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const attemptFetch = async (retryCount: number = 0): Promise<T> => {
    try {
      console.log(`[safeFetch] Attempt ${retryCount + 1}/${config.maxRetries + 1} for ${url}`);

      const response = await fetchWithTimeout();

      if (!response.ok) {
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        globalErrorCounter.recordError(url, errorMessage, response.status);

        if (response.status >= 500 && retryCount < config.maxRetries) {
          const delay = Math.min(
            config.initialDelay * Math.pow(config.backoffFactor, retryCount),
            config.maxDelay
          );
          
          console.log(`[safeFetch] Server error, retrying in ${delay}ms...`);
          await sleep(delay);
          return attemptFetch(retryCount + 1);
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : config.initialDelay;
          
          if (retryCount < config.maxRetries) {
            console.log(`[safeFetch] Rate limited, retrying in ${delay}ms...`);
            await sleep(delay);
            return attemptFetch(retryCount + 1);
          }
        }

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else if (contentType?.includes('text/')) {
        return await response.text() as T;
      } else {
        return response as T;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      globalErrorCounter.recordError(url, errorMessage);

      const isNetworkError = 
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('The Internet connection appears to be offline') ||
        errorMessage.includes('aborted');

      if (isNetworkError && retryCount < config.maxRetries) {
        const delay = Math.min(
          config.initialDelay * Math.pow(config.backoffFactor, retryCount),
          config.maxDelay
        );
        
        console.log(`[safeFetch] Network error, retrying in ${delay}ms...`);
        await sleep(delay);
        return attemptFetch(retryCount + 1);
      }

      throw error;
    }
  };

  if (skipCircuitBreaker) {
    return attemptFetch();
  }

  return globalCircuitBreaker.execute(() => attemptFetch(), url);
}

export function getCircuitBreakerState(): CircuitState {
  return globalCircuitBreaker.getState();
}

export function resetCircuitBreaker(): void {
  globalCircuitBreaker.reset();
  globalErrorCounter.clearErrors();
}

export function getErrorStats() {
  return {
    totalErrors: globalErrorCounter.getErrorCount(),
    recentErrors: globalErrorCounter.getRecentErrors(),
    circuitBreakerState: globalCircuitBreaker.getState(),
    allErrors: globalErrorCounter.getAllErrors(),
  };
}
