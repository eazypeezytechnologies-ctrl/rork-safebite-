import {
  safeFetch,
  resetCircuitBreaker,
  getErrorStats,
  globalErrorCounter,
} from '@/utils/safeFetch';

global.fetch = jest.fn();

describe('safeFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreaker();
    globalErrorCounter.clearErrors();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should successfully fetch data', async () => {
    const mockData = { success: true, data: 'test' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await safeFetch('https://api.example.com/data');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 500 errors', async () => {
    const mockError = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    };

    const mockSuccess = {
      ok: true,
      json: async () => ({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockError)
      .mockResolvedValueOnce(mockSuccess);

    jest.useFakeTimers();

    const promise = safeFetch('https://api.example.com/data');
    
    await jest.advanceTimersByTimeAsync(1000);
    
    const result = await promise;

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should retry on network errors', async () => {
    const mockSuccess = {
      ok: true,
      json: async () => ({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    };

    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(mockSuccess);

    jest.useFakeTimers();

    const promise = safeFetch('https://api.example.com/data');
    
    await jest.advanceTimersByTimeAsync(1000);
    
    const result = await promise;

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should record errors in error counter', async () => {
    const mockError = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockError);

    try {
      await safeFetch('https://api.example.com/data');
    } catch {
      const stats = getErrorStats();
      expect(stats.totalErrors).toBeGreaterThan(0);
    }
  });

  it('should respect timeout', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 5000);
        })
    );

    jest.useFakeTimers();

    const promise = safeFetch('https://api.example.com/data', {
      timeout: 1000,
    });

    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toThrow();

    jest.useRealTimers();
  });

  it('should handle rate limiting with Retry-After header', async () => {
    const mockRateLimit = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 'Retry-After': '2' }),
    };

    const mockSuccess = {
      ok: true,
      json: async () => ({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockRateLimit)
      .mockResolvedValueOnce(mockSuccess);

    jest.useFakeTimers();

    const promise = safeFetch('https://api.example.com/data');
    
    await jest.advanceTimersByTimeAsync(2000);
    
    const result = await promise;

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should open circuit breaker after threshold errors', async () => {
    const mockError = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockError);

    for (let i = 0; i < 4; i++) {
      try {
        await safeFetch('https://api.example.com/data', {
          retryConfig: { maxRetries: 0 },
        });
      } catch {
        
      }
    }

    const stats = getErrorStats();
    expect(stats.circuitBreakerState).toBe('OPEN');
  });

  it('should skip circuit breaker when requested', async () => {
    const mockError = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockError);

    for (let i = 0; i < 4; i++) {
      try {
        await safeFetch('https://api.example.com/data', {
          retryConfig: { maxRetries: 0 },
          skipCircuitBreaker: true,
        });
      } catch {
        
      }
    }

    const mockSuccess = {
      ok: true,
      json: async () => ({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockSuccess);

    const result = await safeFetch('https://api.example.com/data', {
      skipCircuitBreaker: true,
    });

    expect(result).toEqual({ success: true });
  });

  it('should return text for text/plain content', async () => {
    const mockText = 'Plain text response';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => mockText,
      headers: new Headers({ 'content-type': 'text/plain' }),
    });

    const result = await safeFetch('https://api.example.com/data');
    expect(result).toBe(mockText);
  });

  it('should clear errors', () => {
    globalErrorCounter.recordError('test-url', 'test error', 500);
    
    let stats = getErrorStats();
    expect(stats.totalErrors).toBeGreaterThan(0);

    globalErrorCounter.clearErrors();
    
    stats = getErrorStats();
    expect(stats.totalErrors).toBe(0);
  });
});
