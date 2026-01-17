import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    return url;
  }

  return "";
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        const baseUrl = getBaseUrl();
        
        if (!baseUrl) {
          console.log('[tRPC] Backend not configured, returning empty response');
          return new Response(JSON.stringify({ result: { data: null } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            
            if (response.status === 404) {
              console.warn('[tRPC] Route not found (404), returning empty response');
              return new Response(JSON.stringify({ result: { data: null } }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              });
            }
            
            if (response.status >= 500) {
              console.warn('[tRPC] Server error, returning empty response');
              return new Response(JSON.stringify({ result: { data: null } }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              });
            }
            
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            try {
              const responseClone = response.clone();
              if (contentType && contentType.includes('application/json')) {
                const errorData = await responseClone.json();
                errorMessage = errorData.message || errorMessage;
              }
            } catch {
            }
            
            console.error('[tRPC] Request failed:', errorMessage);
            throw new Error(errorMessage);
          }
          
          return response;
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            console.warn('[tRPC] Request timed out, returning empty response');
            return new Response(JSON.stringify({ result: { data: null } }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }
          
          if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
            console.warn('[tRPC] Network error, returning empty response');
            return new Response(JSON.stringify({ result: { data: null } }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }
          
          console.error('[tRPC] Fetch error:', error);
          throw error;
        }
      },
    }),
  ],
});

export const isBackendEnabled = () => !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;