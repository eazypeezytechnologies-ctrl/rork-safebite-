import { publicProcedure } from '@/backend/trpc/create-context';
import { SupabaseService } from '@/backend/services/supabaseService';
import { z } from 'zod';

export const listProfilesRoute = publicProcedure
  .input(z.object({
    userId: z.string(),
  }))
  .query(async ({ input }) => {
    try {
      const profiles = await SupabaseService.getProfiles(input.userId);
      console.log(`[listProfiles] Found ${profiles.length} profiles for user ${input.userId}`);
      return profiles;
    } catch (error) {
      console.error('[listProfiles] Error:', error);
      throw error;
    }
  });
