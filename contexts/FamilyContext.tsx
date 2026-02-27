import { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { FamilyGroup, Profile, ViewMode } from '@/types';
import { useUser } from '@/contexts/UserContext';
import {
  useSupabaseFamilyGroups,
  useCreateFamilyGroup,
  useUpdateFamilyGroup,
  useDeleteFamilyGroup,
  useSupabaseUserSettings,
  useUpsertUserSettings,
  SupabaseFamilyGroup,
} from '@/hooks/useSupabase';

interface FamilyContextValue {
  familyGroups: FamilyGroup[];
  activeFamilyGroup: FamilyGroup | null;
  viewMode: ViewMode;
  isLoading: boolean;
  setViewMode: (mode: ViewMode) => Promise<void>;
  setActiveFamilyGroup: (groupId: string | null) => Promise<void>;
  createFamilyGroup: (group: FamilyGroup) => Promise<FamilyGroup>;
  updateFamilyGroup: (group: FamilyGroup) => Promise<void>;
  deleteFamilyGroup: (groupId: string) => Promise<void>;
  addMemberToFamily: (groupId: string, memberId: string) => Promise<void>;
  removeMemberFromFamily: (groupId: string, memberId: string) => Promise<void>;
  getFamilyMembers: (profiles: Profile[]) => Profile[];
  getCombinedAllergens: (profiles: Profile[]) => string[];
  getCombinedCustomKeywords: (profiles: Profile[]) => string[];
  refreshFamilyGroups: () => Promise<void>;
}

const convertSupabaseFamilyGroupToFamilyGroup = (sfg: SupabaseFamilyGroup): FamilyGroup => ({
  id: sfg.id,
  name: sfg.name,
  memberIds: sfg.member_ids,
  createdAt: sfg.created_at,
  updatedAt: sfg.updated_at,
});

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useUser();
  const userId = currentUser?.id;

  const { data: supabaseFamilyGroups = [], isLoading: familyQueryLoading, isError: familyQueryError, refetch: refetchFamilyGroups } = useSupabaseFamilyGroups(userId);
  const { data: userSettings, isError: settingsQueryError, refetch: refetchSettings } = useSupabaseUserSettings(userId);

  const isLoading = familyQueryLoading && !familyQueryError;

  if (familyQueryError) {
    console.warn('[FamilyContext] Family groups query failed, operating in limited mode');
  }
  if (settingsQueryError) {
    console.warn('[FamilyContext] User settings query failed, operating in limited mode');
  }
  const createFamilyGroupMutation = useCreateFamilyGroup(userId || '');
  const updateFamilyGroupMutation = useUpdateFamilyGroup(userId || '');
  const deleteFamilyGroupMutation = useDeleteFamilyGroup(userId || '');
  const upsertSettingsMutation = useUpsertUserSettings(userId || '');

  const familyGroups = useMemo(() => {
    return supabaseFamilyGroups.map(convertSupabaseFamilyGroupToFamilyGroup);
  }, [supabaseFamilyGroups]);

  const activeFamilyGroup = useMemo(() => {
    const activeId = userSettings?.active_family_group_id;
    if (!activeId) return null;
    const group = supabaseFamilyGroups.find(g => g.id === activeId);
    return group ? convertSupabaseFamilyGroupToFamilyGroup(group) : null;
  }, [supabaseFamilyGroups, userSettings]);

  const viewMode = useMemo<ViewMode>(() => {
    return userSettings?.view_mode || 'individual';
  }, [userSettings]);

  const setViewMode = useCallback(async (mode: ViewMode) => {
    try {
      if (!userId) return;
      await upsertSettingsMutation.mutateAsync({ view_mode: mode });
      console.log('[FamilyContext] View mode set to:', mode);
    } catch (error) {
      console.error('[FamilyContext] Error setting view mode:', error);
      throw error;
    }
  }, [userId, upsertSettingsMutation]);

  const setActiveFamilyGroup = useCallback(async (groupId: string | null) => {
    try {
      if (!userId) return;
      await upsertSettingsMutation.mutateAsync({ active_family_group_id: groupId || undefined });
      const group = groupId ? familyGroups.find(g => g.id === groupId) : null;
      console.log('[FamilyContext] Active family group set to:', group?.name || 'none');
    } catch (error) {
      console.error('[FamilyContext] Error setting active family group:', error);
      throw error;
    }
  }, [userId, familyGroups, upsertSettingsMutation]);

  const createFamilyGroup = useCallback(async (group: FamilyGroup): Promise<FamilyGroup> => {
    try {
      if (!userId) throw new Error('No user logged in');
      console.log('[FamilyContext] Creating family group:', group.name);
      const result = await createFamilyGroupMutation.mutateAsync({
        name: group.name,
        member_ids: group.memberIds,
      });
      await refetchFamilyGroups();
      console.log('[FamilyContext] Family group created successfully:', group.name, 'DB id:', result.id);
      return convertSupabaseFamilyGroupToFamilyGroup(result);
    } catch (error) {
      console.error('[FamilyContext] Error creating family group:', error);
      throw error;
    }
  }, [userId, createFamilyGroupMutation, refetchFamilyGroups]);

  const updateFamilyGroup = useCallback(async (updatedGroup: FamilyGroup) => {
    try {
      await updateFamilyGroupMutation.mutateAsync({
        id: updatedGroup.id,
        updates: {
          name: updatedGroup.name,
          member_ids: updatedGroup.memberIds,
        },
      });
      await refetchFamilyGroups();
      console.log('[FamilyContext] Family group updated:', updatedGroup.name);
    } catch (error) {
      console.error('[FamilyContext] Error updating family group:', error);
      throw error;
    }
  }, [updateFamilyGroupMutation, refetchFamilyGroups]);

  const deleteFamilyGroup = useCallback(async (groupId: string) => {
    try {
      await deleteFamilyGroupMutation.mutateAsync(groupId);
      
      if (activeFamilyGroup?.id === groupId) {
        await upsertSettingsMutation.mutateAsync({ active_family_group_id: undefined });
      }
      
      await refetchFamilyGroups();
      console.log('[FamilyContext] Family group deleted:', groupId);
    } catch (error) {
      console.error('[FamilyContext] Error deleting family group:', error);
      throw error;
    }
  }, [deleteFamilyGroupMutation, activeFamilyGroup, upsertSettingsMutation, refetchFamilyGroups]);

  const addMemberToFamily = useCallback(async (groupId: string, memberId: string) => {
    try {
      const group = familyGroups.find(g => g.id === groupId);
      if (!group) {
        throw new Error('Family group not found');
      }
      
      if (!group.memberIds.includes(memberId)) {
        const updatedGroup = {
          ...group,
          memberIds: [...group.memberIds, memberId],
          updatedAt: new Date().toISOString(),
        };
        await updateFamilyGroup(updatedGroup);
      }
    } catch (error) {
      console.error('Error adding member to family:', error);
      throw error;
    }
  }, [familyGroups, updateFamilyGroup]);

  const removeMemberFromFamily = useCallback(async (groupId: string, memberId: string) => {
    try {
      const group = familyGroups.find(g => g.id === groupId);
      if (!group) {
        throw new Error('Family group not found');
      }
      
      const updatedGroup = {
        ...group,
        memberIds: group.memberIds.filter(id => id !== memberId),
        updatedAt: new Date().toISOString(),
      };
      await updateFamilyGroup(updatedGroup);
    } catch (error) {
      console.error('Error removing member from family:', error);
      throw error;
    }
  }, [familyGroups, updateFamilyGroup]);

  const getFamilyMembers = useCallback((profiles: Profile[]): Profile[] => {
    if (!activeFamilyGroup || viewMode === 'individual') {
      return [];
    }
    
    return profiles.filter(p => activeFamilyGroup.memberIds.includes(p.id));
  }, [activeFamilyGroup, viewMode]);

  const getCombinedAllergens = useCallback((profiles: Profile[]): string[] => {
    if (!activeFamilyGroup || viewMode === 'individual') {
      return [];
    }
    
    const familyMembers = profiles.filter(p => activeFamilyGroup.memberIds.includes(p.id));
    const allAllergens = new Set<string>();
    
    familyMembers.forEach(member => {
      member.allergens.forEach(allergen => allAllergens.add(allergen));
    });
    
    return Array.from(allAllergens);
  }, [activeFamilyGroup, viewMode]);

  const getCombinedCustomKeywords = useCallback((profiles: Profile[]): string[] => {
    if (!activeFamilyGroup || viewMode === 'individual') {
      return [];
    }
    
    const familyMembers = profiles.filter(p => activeFamilyGroup.memberIds.includes(p.id));
    const allKeywords = new Set<string>();
    
    familyMembers.forEach(member => {
      member.customKeywords.forEach(keyword => allKeywords.add(keyword));
    });
    
    return Array.from(allKeywords);
  }, [activeFamilyGroup, viewMode]);

  const refreshFamilyGroups = useCallback(async () => {
    await refetchFamilyGroups();
    await refetchSettings();
  }, [refetchFamilyGroups, refetchSettings]);

  const value = useMemo(
    () => ({
      familyGroups,
      activeFamilyGroup,
      viewMode,
      isLoading,
      setViewMode,
      setActiveFamilyGroup,
      createFamilyGroup,
      updateFamilyGroup,
      deleteFamilyGroup,
      addMemberToFamily,
      removeMemberFromFamily,
      getFamilyMembers,
      getCombinedAllergens,
      getCombinedCustomKeywords,
      refreshFamilyGroups,
    }),
    [
      familyGroups,
      activeFamilyGroup,
      viewMode,
      isLoading,
      setViewMode,
      setActiveFamilyGroup,
      createFamilyGroup,
      updateFamilyGroup,
      deleteFamilyGroup,
      addMemberToFamily,
      removeMemberFromFamily,
      getFamilyMembers,
      getCombinedAllergens,
      getCombinedCustomKeywords,
      refreshFamilyGroups,
    ]
  );

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }
  return context;
}
