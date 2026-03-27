import { publicProcedure } from '@/backend/trpc/create-context';
import { SupabaseService } from '@/backend/services/supabaseService';
import { z } from 'zod';

export const createProfileRoute = publicProcedure
  .input(z.object({
    userId: z.string(),
    name: z.string(),
    relationship: z.string().optional(),
    dateOfBirth: z.string().optional(),
    allergens: z.array(z.string()),
    customKeywords: z.array(z.string()),
    hasAnaphylaxis: z.boolean(),
    emergencyContacts: z.array(z.object({
      name: z.string(),
      phone: z.string(),
      relationship: z.string(),
    })),
    medications: z.array(z.string()),
    avatarColor: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    try {
      const newProfile = await SupabaseService.createProfile({
        user_id: input.userId,
        name: input.name,
        relationship: input.relationship,
        date_of_birth: input.dateOfBirth,
        allergens: input.allergens,
        custom_keywords: input.customKeywords,
        has_anaphylaxis: input.hasAnaphylaxis,
        emergency_contacts: input.emergencyContacts,
        medications: input.medications,
        avatar_color: input.avatarColor,
      });

      console.log(`[createProfile] Created profile ${newProfile.id} for user ${input.userId}`);
      return newProfile;
    } catch (error) {
      console.error('[createProfile] Error:', error);
      throw error;
    }
  });
