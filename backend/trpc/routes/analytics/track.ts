import { publicProcedure } from '@/backend/trpc/create-context';
import { SupabaseService } from '@/backend/services/supabaseService';
import { z } from 'zod';

export const trackEventRoute = publicProcedure
  .input(z.object({
    userId: z.string(),
    eventType: z.enum(['scan', 'search', 'recall_check', 'profile_create', 'profile_update', 'login', 'signup', 'favorite_add', 'favorite_remove', 'shopping_list_add', 'shopping_list_remove']),
    eventData: z.record(z.string(), z.any()).optional(),
  }))
  .mutation(async ({ input }) => {
    try {
      await SupabaseService.trackAnalytics(
        input.userId,
        input.eventType,
        input.eventData
      );
      console.log(`[trackEvent] ${input.eventType} for user ${input.userId}`);
      return { success: true };
    } catch (error) {
      console.error('[trackEvent] Error:', error);
      return { success: false };
    }
  });
