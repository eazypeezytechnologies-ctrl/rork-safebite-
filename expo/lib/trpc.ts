import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { requestThrottler } from "@/utils/requestThrottler";
import { supabase } from "@/lib/supabase";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    return url;
  }
  return "";
};

const pendingRequests = new Map<string, Promise<Response>>();
let lastRequestTime = 0;
const MIN_REQUEST_GAP_MS = 100;

const getDedupeKey = (url: string | URL | Request, options?: RequestInit): string => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
  const method = options?.method || 'GET';
  const body = options?.body ? String(options.body).substring(0, 100) : '';
  return `${method}:${urlStr}:${body}`;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        const baseUrl = getBaseUrl();
        
        if (!baseUrl) {
          return new Response(JSON.stringify({ result: { data: null } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        let authHeaders: Record<string, string> = {};
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
          }
        } catch (e) {
          console.warn('[tRPC] Failed to get auth session for header:', e);
        }

        const mergedOptions = {
          ...options,
          headers: {
            ...options?.headers,
            ...authHeaders,
          },
        };

        if (false) {
          return new Response(JSON.stringify({ result: { data: null } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (requestThrottler.isThrottled()) {
          const retryAfter = requestThrottler.getRetryAfterSeconds();
          console.warn(`[tRPC] Throttled, retry in ${retryAfter}s`);
          return new Response(JSON.stringify({ 
            result: { data: null },
            error: { message: `Rate limited. Retry in ${retryAfter}s` }
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        const dedupeKey = getDedupeKey(url, options);
        const existingRequest = pendingRequests.get(dedupeKey);
        if (existingRequest) {
          console.log('[tRPC] Deduplicating request');
          return existingRequest;
        }

        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_GAP_MS) {
          await new Promise(r => setTimeout(r, MIN_REQUEST_GAP_MS - timeSinceLastRequest));
        }
        lastRequestTime = Date.now();
        
        const fetchPromise = (async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          
          try {
            const response = await fetch(url, {
              ...mergedOptions,
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              const waitSecs = retryAfter ? parseInt(retryAfter) : 30;
              requestThrottler.recordError(true);
              console.warn(`[tRPC] Rate limited (429), backing off for ${waitSecs}s`);
              return new Response(JSON.stringify({ 
                result: { data: null },
                error: { message: `Too many requests. Please wait ${waitSecs} seconds.` }
              }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              });
            }
            
            if (!response.ok) {
              if (response.status === 404) {
                return new Response(JSON.stringify({ result: { data: null } }), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                });
              }
              
              if (response.status >= 500) {
                requestThrottler.recordError(false);
                return new Response(JSON.stringify({ result: { data: null } }), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                });
              }
              
              requestThrottler.recordError(false);
              throw new Error(`HTTP ${response.status}`);
            }
            
            requestThrottler.recordSuccess();
            return response;
          } catch (error: any) {
            clearTimeout(timeoutId);
            
            const msg = error?.message || '';
            const isNetworkError = (
              error?.name === 'AbortError' ||
              error?.name === 'TypeError' ||
              msg.includes('Load failed') ||
              msg.includes('Failed to fetch') ||
              msg.includes('fetch failed') ||
              msg.includes('Network request failed') ||
              msg.includes('NetworkError') ||
              msg.includes('Network') ||
              msg.includes('CORS') ||
              msg.includes('timeout') ||
              msg.includes('aborted')
            );

            if (isNetworkError) {
              requestThrottler.recordError(false);
              console.warn('[tRPC] Network/fetch error caught:', msg || error?.name);
            } else {
              console.warn('[tRPC] Unexpected fetch error, suppressing:', msg);
            }

            return new Response(JSON.stringify({ result: { data: null } }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }
        })();

        pendingRequests.set(dedupeKey, fetchPromise);
        
        fetchPromise.finally(() => {
          setTimeout(() => pendingRequests.delete(dedupeKey), 2000);
        });
        
        return fetchPromise;
      },
    }),
  ],
});

export const isBackendEnabled = () => !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

export const getTRPCThrottleState = () => ({
  isThrottled: requestThrottler.isThrottled(),
  retryAfterSeconds: requestThrottler.getRetryAfterSeconds(),
  resetThrottle: () => requestThrottler.resetThrottle(),
});