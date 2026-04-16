export interface FriendlyError {
  title: string;
  message: string;
  recoverable: boolean;
  silent?: boolean;
}

export function mapErrorToFriendly(error: unknown): FriendlyError {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as any)?.code || '';
  const lowerMsg = msg.toLowerCase();

  if (lowerMsg.includes('circuit breaker') || lowerMsg.includes('circuit is open')) {
    return {
      title: 'Having trouble loading',
      message: 'Having trouble loading, retrying automatically...',
      recoverable: true,
      silent: true,
    };
  }

  if (lowerMsg.includes('supabase') || lowerMsg.includes('postgrest') || lowerMsg.includes('pgrst')) {
    return {
      title: 'Having trouble loading',
      message: 'Having trouble connecting. Please try again in a moment.',
      recoverable: true,
      silent: true,
    };
  }

  if (code === '42501' || lowerMsg.includes('42501') || lowerMsg.includes('permission denied') || lowerMsg.includes('permission')) {
    return {
      title: 'Temporarily Unavailable',
      message: 'This feature is temporarily unavailable. Please try again later.',
      recoverable: false,
      silent: true,
    };
  }

  if (code === '42P17' || lowerMsg.includes('infinite recursion')) {
    return {
      title: 'Temporarily Unavailable',
      message: 'Something went wrong on our end. Please try again later.',
      recoverable: false,
      silent: true,
    };
  }

  if (code === '23503' || lowerMsg.includes('foreign key') || lowerMsg.includes('fkey') || lowerMsg.includes('23503')) {
    return {
      title: 'Something Went Wrong',
      message: 'Please try again. If this persists, recreate the group.',
      recoverable: false,
    };
  }

  if (lowerMsg.includes('expired')) {
    return {
      title: 'Invitation Expired',
      message: 'This invitation has expired. Please create a new one.',
      recoverable: true,
    };
  }

  if (lowerMsg.includes('max') || lowerMsg.includes('limit')) {
    return {
      title: 'Limit Reached',
      message: 'This group has reached the maximum number of members.',
      recoverable: false,
    };
  }

  if (
    lowerMsg.includes('load failed') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('aborted')
  ) {
    return {
      title: 'Having trouble loading',
      message: 'Having trouble loading, retrying...',
      recoverable: true,
      silent: true,
    };
  }

  if (lowerMsg.includes('http 5') || lowerMsg.includes('500') || lowerMsg.includes('502') || lowerMsg.includes('503') || lowerMsg.includes('504')) {
    return {
      title: 'Having trouble loading',
      message: 'Our servers are busy. Please try again in a moment.',
      recoverable: true,
      silent: true,
    };
  }

  if (lowerMsg.includes('[object object]') || msg === '' || msg === 'unknown') {
    return {
      title: 'Something Went Wrong',
      message: 'Something unexpected happened. Please try again.',
      recoverable: true,
      silent: true,
    };
  }

  return {
    title: 'Something Went Wrong',
    message: 'Something unexpected happened. Please try again.',
    recoverable: true,
  };
}

export function getFriendlyErrorMessage(error: unknown): string {
  return mapErrorToFriendly(error).message;
}

export function isSilentError(error: unknown): boolean {
  return mapErrorToFriendly(error).silent === true;
}
