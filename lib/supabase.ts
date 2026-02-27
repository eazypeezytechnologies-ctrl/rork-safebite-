import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl;

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey;

const isMissingConfig = !supabaseUrl || !supabaseAnonKey || 
  supabaseUrl === 'placeholder' || supabaseAnonKey === 'placeholder';

if (isMissingConfig) {
  console.warn('[Supabase] Missing configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
}

const createSupabaseClient = (): SupabaseClient => {
  if (isMissingConfig) {
    console.error('[Supabase] Cannot create client - missing URL or anon key');
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  
  console.log('[Supabase] Creating client with URL:', supabaseUrl?.substring(0, 30) + '...');
  
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    global: {
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const signal = options.signal || controller.signal;
        return fetch(url, {
          ...options,
          signal,
        }).then((res) => {
          clearTimeout(timeoutId);
          return res;
        }).catch((err) => {
          clearTimeout(timeoutId);
          const msg = err?.message || '';
          const isNetworkError = (
            err?.name === 'AbortError' ||
            err?.name === 'TypeError' ||
            msg.includes('Load failed') ||
            msg.includes('Failed to fetch') ||
            msg.includes('fetch failed') ||
            msg.includes('Network request failed') ||
            msg.includes('NetworkError')
          );
          if (isNetworkError) {
            console.warn('[Supabase] Network error (non-fatal):', msg || err?.name);
          }
          throw err;
        });
      },
    },
  });
};

export const supabase = createSupabaseClient();

export const isSupabaseConfigured = (): boolean => {
  return !isMissingConfig;
};

export const getSupabaseUrl = (): string | undefined => supabaseUrl;
