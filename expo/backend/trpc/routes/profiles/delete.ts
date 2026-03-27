import { publicProcedure } from '@/backend/trpc/create-context';
import { SupabaseService } from '@/backend/services/supabaseService';
import { z } from 'zod';

export const deleteProfileRoute = publicProcedure
  .input(z.object({
    id: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      await SupabaseService.deleteProfile(input.id);
      console.log(`[deleteProfile] Deleted profile ${input.id}`);
      return { success: true };
    } catch (error) {
      console.error('[deleteProfile] Error:', error);
      throw error;
    }
  });
