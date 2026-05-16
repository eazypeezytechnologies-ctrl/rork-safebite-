import { supabase } from './supabase';

const AI_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`;

const UNAVAILABLE_TEXT = 'AI check is temporarily unavailable. You can still review the ingredients and verify the label.';
const UNAVAILABLE_OBJECT_TEXT = 'AI check is temporarily unavailable.';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; [key: string]: unknown }>;
}


async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch {
    // non-fatal
  }
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    return { Authorization: `Bearer ${anonKey}` };
  }
  return {};
}

export async function generateText(
  options: { messages: Message[] } | string
): Promise<string> {
  const messages: Message[] = typeof options === 'string'
    ? [{ role: 'user', content: options }]
    : options.messages;

  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        ...authHeader,
      },
      body: JSON.stringify({ type: 'text', messages }),
      signal: AbortSignal.timeout?.(25000),
    });

    if (!response.ok) {
      console.warn('[aiAdapter] generateText HTTP error:', response.status);
      return UNAVAILABLE_TEXT;
    }

    const data = await response.json();
    return typeof data?.result === 'string' ? data.result : UNAVAILABLE_TEXT;
  } catch (err) {
    console.warn('[aiAdapter] generateText failed (non-fatal):', err instanceof Error ? err.message : err);
    return UNAVAILABLE_TEXT;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateObject(
  options: { messages: Message[]; schema?: unknown }
): Promise<any> {
  const { messages } = options;

  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        ...authHeader,
      },
      body: JSON.stringify({ type: 'object', messages, schema: options.schema }),
      signal: AbortSignal.timeout?.(25000),
    });

    if (!response.ok) {
      console.warn('[aiAdapter] generateObject HTTP error:', response.status);
      return { error: UNAVAILABLE_OBJECT_TEXT };
    }

    const data = await response.json();
    return data?.result ?? { error: UNAVAILABLE_OBJECT_TEXT };
  } catch (err) {
    console.warn('[aiAdapter] generateObject failed (non-fatal):', err instanceof Error ? err.message : err);
    return { error: UNAVAILABLE_OBJECT_TEXT };
  }
}
