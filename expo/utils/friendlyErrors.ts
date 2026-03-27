export interface FriendlyError {
  title: string;
  message: string;
  recoverable: boolean;
}

export function mapErrorToFriendly(error: unknown): FriendlyError {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as any)?.code || '';

  if (code === '42501' || msg.includes('42501') || msg.includes('permission denied') || msg.includes('permission')) {
    return {
      title: 'Permissions Not Ready',
      message: 'Invite permissions are not fully configured yet. The admin needs to finish Supabase invite policies.',
      recoverable: false,
    };
  }

  if (code === '42P17' || msg.includes('infinite recursion')) {
    return {
      title: 'Database Policy Issue',
      message: 'A database policy configuration issue is preventing this action. Please contact admin.',
      recoverable: false,
    };
  }

  if (code === '23503' || msg.includes('foreign key') || msg.includes('fkey') || msg.includes('23503')) {
    return {
      title: 'Reference Error',
      message: 'This invite is linked to a missing group ID. Please try deleting and recreating the group.',
      recoverable: false,
    };
  }

  if (msg.includes('expired')) {
    return {
      title: 'Invitation Expired',
      message: 'This invitation has expired. Please create a new one.',
      recoverable: true,
    };
  }

  if (msg.includes('max') || msg.includes('limit')) {
    return {
      title: 'Member Limit Reached',
      message: 'This family group has reached the maximum number of members (including pending invites).',
      recoverable: false,
    };
  }

  if (
    msg.includes('Load failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('Network request failed') ||
    msg.includes('network') ||
    msg.includes('timeout')
  ) {
    return {
      title: 'Connection Issue',
      message: 'Network error. Please check your connection and try again.',
      recoverable: true,
    };
  }

  if (msg.includes('[object Object]') || msg === '' || msg === 'unknown') {
    return {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again or contact support.',
      recoverable: true,
    };
  }

  return {
    title: 'Error',
    message: msg || 'An unexpected error occurred. Please try again.',
    recoverable: true,
  };
}

export function getFriendlyErrorMessage(error: unknown): string {
  return mapErrorToFriendly(error).message;
}
