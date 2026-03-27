export function formatUserError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errorMappings: Record<string, string> = {
    'network request failed': 'Unable to connect. Please check your internet connection.',
    'timeout': 'The request took too long. Please try again.',
    'fetch failed': 'Unable to connect to the server. Please try again.',
    'invalid login credentials': 'Invalid email or password. Please try again.',
    'email not confirmed': 'Please check your email and confirm your account.',
    'already registered': 'An account with this email already exists.',
    'user not found': 'No account found with this email.',
    'rate limit': 'Too many requests. Please wait a moment and try again.',
    'permission denied': 'You don\'t have permission to perform this action.',
    'session expired': 'Your session has expired. Please sign in again.',
    'invalid barcode': 'The scanned code is not a valid product barcode.',
    'product not found': 'We couldn\'t find this product in our database.',
    'profile creation failed': 'Failed to create profile. Please try again.',
    'profile update failed': 'Failed to update profile. Please try again.',
    'profile deletion failed': 'Failed to delete profile. Please try again.',
    'connection refused': 'Unable to connect to the server. Please try again later.',
    'jwt expired': 'Your session has expired. Please sign in again.',
    'pgrst': 'There was a database error. Please try again.',
  };

  const lowerMessage = errorMessage.toLowerCase();
  
  for (const [key, friendlyMessage] of Object.entries(errorMappings)) {
    if (lowerMessage.includes(key)) {
      return friendlyMessage;
    }
  }

  if (lowerMessage.includes('error') && lowerMessage.length > 100) {
    return 'Something went wrong. Please try again.';
  }

  if (errorMessage.startsWith('{') || errorMessage.includes('undefined')) {
    return 'An unexpected error occurred. Please try again.';
  }

  return errorMessage.length > 150 
    ? 'Something went wrong. Please try again.' 
    : errorMessage;
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  return (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('offline')
  );
}

export function isAuthError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  return (
    lowerMessage.includes('session') ||
    lowerMessage.includes('jwt') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('unauthenticated') ||
    lowerMessage.includes('login') ||
    lowerMessage.includes('credentials')
  );
}

export function getErrorRecoveryAction(error: unknown): 'retry' | 'refresh' | 'login' | 'contact_support' {
  if (isNetworkError(error)) return 'retry';
  if (isAuthError(error)) return 'login';
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden')) {
    return 'contact_support';
  }
  
  return 'refresh';
}
