import { publicProcedure } from '@/backend/trpc/create-context';
import { SupabaseService } from '@/backend/services/supabaseService';
import { z } from 'zod';

export const getStatsRoute = publicProcedure
  .input(z.object({
    userId: z.string().optional(),
  }))
  .query(async ({ input }) => {
    try {
      const stats = await SupabaseService.getAnalyticsStats(input.userId);
      console.log(`[getStats] Retrieved stats for user ${input.userId || 'all'}`);
      return stats;
    } catch (error) {
      console.error('[getStats] Error:', error);
      return {
        totalScans: 0,
        totalProfiles: 0,
        recentActivity: [],
      };
    }
  });
