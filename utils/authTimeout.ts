const DEFAULT_TIMEOUT = 25000; // 25 seconds - very forgiving for slow connections
const MAX_RETRIES = 1; // One retry for reliability
const RETRY_DELAY = 2000; // 2 seconds between retries
const CONNECTIVITY_CHECK_TIMEOUT = 8000; // 8 seconds for connectivity check
const SESSION_CHECK_TIMEOUT = 15000; // 15 seconds for session check

export class AuthTimeoutError extends Error {
  constructor(message: string = 'Connection timed out. Please check your internet and try again.') {
    super(message);
    this.name = 'AuthTimeoutError';
  }
}

export class AuthConnectionError extends Error {
  constructor(message: string = 'Unable to connect. Please check your internet connection.') {
    super(message);
    this.name = 'AuthConnectionError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT,
  errorMessage?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AuthTimeoutError(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    retryDelay = RETRY_DELAY,
    timeout = DEFAULT_TIMEOUT,
    onRetry,
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(fn(), timeout);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.log(`[AuthRetry] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If it's a timeout error, throw it as is
  if (lastError instanceof AuthTimeoutError) {
    throw lastError;
  }

  // Check for network errors
  const errorMessage = lastError.message.toLowerCase();
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout')
  ) {
    throw new AuthConnectionError();
  }

  throw lastError;
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof AuthTimeoutError;
}

export function isConnectionError(error: unknown): boolean {
  return error instanceof AuthConnectionError || isTimeoutError(error);
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthTimeoutError) {
    return 'Connection timed out. Please check your internet and try again.';
  }
  
  if (error instanceof AuthConnectionError) {
    return 'Unable to connect. Please check your internet connection.';
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('network') || msg.includes('fetch failed')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (msg.includes('invalid login')) {
      return 'Invalid email or password. Please try again.';
    }
    
    if (msg.includes('email not confirmed')) {
      return 'Please check your email and confirm your account.';
    }
    
    if (msg.includes('already registered')) {
      return 'An account with this email already exists.';
    }

    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

// Quick connectivity check - fails fast if no connection
export async function checkConnectivity(supabaseUrl: string): Promise<{ ok: boolean; latency: number }> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT);
    
    // Use HEAD request to health endpoint for minimal data transfer
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - start;
    
    console.log(`[Connectivity] Check completed in ${latency}ms, status: ${response.status}`);
    return { ok: true, latency };
  } catch (error) {
    const latency = Date.now() - start;
    console.log(`[Connectivity] Check failed after ${latency}ms:`, error);
    return { ok: false, latency };
  }
}

// Get recommended session timeout
export function getSessionCheckTimeout(): number {
  return SESSION_CHECK_TIMEOUT;
}

// Check if we should skip session check (for faster startup)
export function shouldSkipSessionCheck(): boolean {
  // Skip if we've had recent failures
  return false;
}

// Offline mode detection - checks multiple endpoints for reliability
export async function isOffline(): Promise<boolean> {
  const endpoints = [
    'https://www.google.com/favicon.ico',
    'https://www.cloudflare.com/favicon.ico',
    'https://1.1.1.1/favicon.ico',
  ];
  
  const checkEndpoint = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return false; // Online
    } catch {
      return true; // Offline or failed
    }
  };
  
  // Try all endpoints in parallel, return online if any succeed
  const results = await Promise.all(endpoints.map(checkEndpoint));
  return results.every(offline => offline); // Only offline if ALL fail
}

// Categorize error type for faster user feedback
export function categorizeAuthError(error: unknown): 'credentials' | 'connection' | 'unknown' {
  if (error instanceof AuthTimeoutError || error instanceof AuthConnectionError) {
    return 'connection';
  }
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (
      msg.includes('invalid login') ||
      msg.includes('invalid email') ||
      msg.includes('invalid password') ||
      msg.includes('wrong password') ||
      msg.includes('user not found') ||
      msg.includes('email not confirmed') ||
      msg.includes('already registered')
    ) {
      return 'credentials';
    }
    
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('connection') ||
      msg.includes('timeout') ||
      msg.includes('abort')
    ) {
      return 'connection';
    }
  }
  
  return 'unknown';
}
