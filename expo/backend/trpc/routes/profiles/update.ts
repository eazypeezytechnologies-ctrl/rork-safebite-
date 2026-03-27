import { publicProcedure } from '@/backend/trpc/create-context';
import { SupabaseService } from '@/backend/services/supabaseService';
import { z } from 'zod';

export const updateProfileRoute = publicProcedure
  .input(z.object({
    id: z.string(),
    name: z.string().optional(),
    relationship: z.string().optional(),
    dateOfBirth: z.string().optional(),
    allergens: z.array(z.string()).optional(),
    customKeywords: z.array(z.string()).optional(),
    hasAnaphylaxis: z.boolean().optional(),
    emergencyContacts: z.array(z.object({
      name: z.string(),
      phone: z.string(),
      relationship: z.string(),
    })).optional(),
    medications: z.array(z.string()).optional(),
    avatarColor: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    try {
      const { id, ...updates } = input;
      
      const supabaseUpdates: any = {};
      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.relationship !== undefined) supabaseUpdates.relationship = updates.relationship;
      if (updates.dateOfBirth !== undefined) supabaseUpdates.date_of_birth = updates.dateOfBirth;
      if (updates.allergens !== undefined) supabaseUpdates.allergens = updates.allergens;
      if (updates.customKeywords !== undefined) supabaseUpdates.custom_keywords = updates.customKeywords;
      if (updates.hasAnaphylaxis !== undefined) supabaseUpdates.has_anaphylaxis = updates.hasAnaphylaxis;
      if (updates.emergencyContacts !== undefined) supabaseUpdates.emergency_contacts = updates.emergencyContacts;
      if (updates.medications !== undefined) supabaseUpdates.medications = updates.medications;
      if (updates.avatarColor !== undefined) supabaseUpdates.avatar_color = updates.avatarColor;

      const updatedProfile = await SupabaseService.updateProfile(id, supabaseUpdates);
      console.log(`[updateProfile] Updated profile ${id}`);
      return updatedProfile;
    } catch (error) {
      console.error('[updateProfile] Error:', error);
      throw error;
    }
  });
