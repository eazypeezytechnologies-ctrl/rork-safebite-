import createContextHook from '@nkzw/create-context-hook';
import { Profile } from '@/types';
import { useUser } from '@/contexts/UserContext';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSupabaseProfiles,
  useCreateProfile,
  useUpdateProfile,
  useDeleteProfile,
  useSupabaseUserSettings,
  useUpsertUserSettings,
  SupabaseProfile,
} from '@/hooks/useSupabase';

const convertSupabaseProfileToProfile = (sp: SupabaseProfile): Profile => ({
  id: sp.id,
  name: sp.name,
  relationship: sp.relationship as Profile['relationship'],
  dateOfBirth: sp.date_of_birth,
  allergens: sp.allergens,
  customKeywords: sp.custom_keywords,
  hasAnaphylaxis: sp.has_anaphylaxis,
  emergencyContacts: sp.emergency_contacts,
  medications: sp.medications,
  avatarColor: sp.avatar_color,
  trackEczemaTriggers: sp.track_eczema_triggers || false,
  eczemaTriggerGroups: sp.eczema_trigger_groups || [],
  createdAt: sp.created_at,
  updatedAt: sp.updated_at,
});

const convertProfileToSupabaseProfile = (p: Partial<Profile>): Partial<Omit<SupabaseProfile, 'id' | 'created_at' | 'updated_at' | 'user_id'>> => ({
  name: p.name,
  relationship: p.relationship,
  date_of_birth: p.dateOfBirth,
  allergens: p.allergens || [],
  custom_keywords: p.customKeywords || [],
  has_anaphylaxis: p.hasAnaphylaxis || false,
  emergency_contacts: p.emergencyContacts || [],
  medications: p.medications || [],
  avatar_color: p.avatarColor,
  track_eczema_triggers: p.trackEczemaTriggers || false,
  eczema_trigger_groups: p.eczemaTriggerGroups || [],
});

export const [ProfileProvider, useProfiles] = createContextHook(() => {
  const { currentUser, isLoading: userLoading } = useUser();
  const userId = currentUser?.id;
  const isAdmin = currentUser?.isAdmin || false;
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const [optimisticActiveProfileId, setOptimisticActiveProfileId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | undefined>(undefined);

  const { 
    data: supabaseProfiles = [], 
    isLoading: profilesLoading, 
    refetch: refetchProfiles, 
    isFetched: profilesFetched,
    isError: profilesFetchError,
    isSuccess: profilesFetchSuccess,
  } = useSupabaseProfiles(isAdmin ? undefined : userId);
  const { 
    data: userSettings, 
    isLoading: settingsLoading, 
    refetch: refetchSettings, 
    isFetched: settingsFetched,
    isError: settingsFetchError,
  } = useSupabaseUserSettings(isAdmin ? undefined : userId);

  useEffect(() => {
    if (previousUserIdRef.current && previousUserIdRef.current !== userId) {
      console.log('[ProfileContext] User changed, clearing profile cache');
      queryClient.removeQueries({ queryKey: ['supabase-profiles', previousUserIdRef.current] });
      queryClient.removeQueries({ queryKey: ['supabase-user-settings', previousUserIdRef.current] });
    }
    previousUserIdRef.current = userId;
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) {
      console.log('[ProfileContext] No user, clearing all profile queries');
      queryClient.removeQueries({ queryKey: ['supabase-profiles'] });
      queryClient.removeQueries({ queryKey: ['supabase-user-settings'] });
    }
  }, [userId, queryClient]);
  const createProfileMutation = useCreateProfile(userId || '');
  const updateProfileMutation = useUpdateProfile(userId || '');
  const deleteProfileMutation = useDeleteProfile(userId || '');
  const upsertSettingsMutation = useUpsertUserSettings(userId || '');

  const setActiveProfile = useCallback(async (profileId: string) => {
    try {
      if (!userId) {
        console.warn('[ProfileContext] Cannot set active profile - no user logged in');
        return;
      }
      
      // Check if profile exists
      const profileExists = supabaseProfiles.some(p => p.id === profileId);
      if (!profileExists) {
        console.warn('[ProfileContext] Profile not found:', profileId);
        return;
      }
      
      // Set optimistic update immediately for instant UI feedback
      console.log('[ProfileContext] Setting optimistic active profile:', profileId);
      setOptimisticActiveProfileId(profileId);
      setIsSwitchingProfile(true);
      
      await upsertSettingsMutation.mutateAsync({ active_profile_id: profileId });
      console.log('[ProfileContext] Active profile saved to server:', profileId);
      
      // Clear optimistic state after successful save
      setOptimisticActiveProfileId(null);
    } catch (error: any) {
      const errorMsg = error?.message || error?.code || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      console.error('[ProfileContext] Error setting active profile:', errorMsg);
      // Revert optimistic update on error
      setOptimisticActiveProfileId(null);
    } finally {
      setIsSwitchingProfile(false);
    }
  }, [userId, upsertSettingsMutation, supabaseProfiles]);



  useEffect(() => {
    if (!userId || profilesLoading || settingsLoading || isSwitchingProfile) {
      return;
    }
    
    if (supabaseProfiles.length > 0 && !userSettings?.active_profile_id) {
      console.log('[ProfileContext] Auto-setting first profile as active');
      const firstProfile = supabaseProfiles[0];
      setActiveProfile(firstProfile.id);
    }
  }, [userId, supabaseProfiles, userSettings?.active_profile_id, profilesLoading, settingsLoading, setActiveProfile, isSwitchingProfile]);

  const profiles = useMemo(() => {
    return supabaseProfiles.map(convertSupabaseProfileToProfile);
  }, [supabaseProfiles]);

  const activeProfile = useMemo(() => {
    // Use optimistic ID if available (for instant UI feedback)
    const activeId = optimisticActiveProfileId || userSettings?.active_profile_id;
    
    if (activeId) {
      const profile = supabaseProfiles.find(p => p.id === activeId);
      if (profile) {
        return convertSupabaseProfileToProfile(profile);
      }
    }
    
    if (supabaseProfiles.length > 0 && !settingsLoading) {
      console.log('[ProfileContext] No active profile set, using first profile as fallback');
      return convertSupabaseProfileToProfile(supabaseProfiles[0]);
    }
    
    return null;
  }, [supabaseProfiles, userSettings?.active_profile_id, settingsLoading, optimisticActiveProfileId]);

  const addProfile = useCallback(async (profile: Profile) => {
    if (!userId) throw new Error('No user logged in');
    console.log('[ProfileContext] Adding profile:', profile.name);
    
    try {
      const supabaseProfile = convertProfileToSupabaseProfile(profile);
      
      const created = await createProfileMutation.mutateAsync(supabaseProfile as any);
      
      await setActiveProfile(created.id);
      await refetchProfiles();
      
      console.log('[ProfileContext] Profile created:', created.id);
    } catch (error: any) {
      const errorMsg = error?.message || error?.code || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      console.error('[ProfileContext] Error in addProfile:', errorMsg);
      throw error;
    }
  }, [userId, createProfileMutation, setActiveProfile, refetchProfiles]);

  const updateProfile = useCallback(async (profile: Profile) => {
    console.log('[ProfileContext] Updating profile:', profile.name);
    
    const supabaseProfile = convertProfileToSupabaseProfile(profile);
    await updateProfileMutation.mutateAsync({ id: profile.id, updates: supabaseProfile as any });
    await refetchProfiles();
  }, [updateProfileMutation, refetchProfiles]);

  const deleteProfile = useCallback(async (profileId: string) => {
    console.log('[ProfileContext] Deleting profile:', profileId);
    
    await deleteProfileMutation.mutateAsync(profileId);
    
    if (userSettings?.active_profile_id === profileId) {
      await refetchProfiles();
      const remainingProfiles = supabaseProfiles.filter(p => p.id !== profileId);
      if (remainingProfiles.length > 0) {
        await setActiveProfile(remainingProfiles[0].id);
      } else {
        await upsertSettingsMutation.mutateAsync({ active_profile_id: undefined });
      }
    }
    
    await refetchProfiles();
  }, [deleteProfileMutation, userSettings, supabaseProfiles, refetchProfiles, setActiveProfile, upsertSettingsMutation]);

  const refreshProfiles = useCallback(async () => {
    console.log('[ProfileContext] Refreshing profiles');
    await refetchProfiles();
    await refetchSettings();
  }, [refetchProfiles, refetchSettings]);

  const clearAllData = useCallback(async () => {
    console.log('[ProfileContext] Clearing all profile data...');
    console.log('[ProfileContext] Data is now in Supabase and cleared on logout');
  }, []);

  const isLoading = useMemo(() => {
    if (userLoading) return true;
    if (!userId) return false;
    if (isAdmin) return false;
    if (!profilesFetched) return true;
    if (!settingsFetched) return true;
    return false;
  }, [userLoading, userId, isAdmin, profilesFetched, settingsFetched]);

  const profilesFetchComplete = useMemo(() => {
    if (!userId) return true;
    if (isAdmin) return true;
    if (profilesFetchError) {
      console.log('[ProfileContext] Fetch error occurred, not marking as complete');
      return false;
    }
    return profilesFetched && profilesFetchSuccess;
  }, [userId, isAdmin, profilesFetched, profilesFetchError, profilesFetchSuccess]);

  const hasFetchError = useMemo(() => {
    return profilesFetchError || settingsFetchError;
  }, [profilesFetchError, settingsFetchError]);

  return useMemo(() => ({
    profiles,
    activeProfile,
    isLoading,
    isSwitchingProfile,
    profilesFetchComplete,
    hasFetchError,
    setActiveProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    refreshProfiles,
    clearAllData,
  }), [profiles, activeProfile, isLoading, isSwitchingProfile, profilesFetchComplete, hasFetchError, setActiveProfile, addProfile, updateProfile, deleteProfile, refreshProfiles, clearAllData]);
});
