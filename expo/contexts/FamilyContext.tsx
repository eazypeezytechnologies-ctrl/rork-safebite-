import { createContext, useContext, useMemo, useCallback, useState, ReactNode } from 'react';
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

type FamilyErrorType = 'rls' | 'network' | 'fk' | 'unknown' | null;

interface FamilyContextValue {
  familyGroups: FamilyGroup[];
  activeFamilyGroup: FamilyGroup | null;
  viewMode: ViewMode;
  isLoading: boolean;
  isLimitedMode: boolean;
  lastError: FamilyErrorType;
  lastErrorMessage: string | null;
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
  dismissLimitedMode: () => void;
}

const convertSupabaseFamilyGroupToFamilyGroup = (sfg: SupabaseFamilyGroup): FamilyGroup => ({
  id: sfg.id,
  name: sfg.name,
  memberIds: sfg.member_ids,
  createdAt: sfg.created_at,
  updatedAt: sfg.updated_at,
});

function classifyError(error: unknown): { type: FamilyErrorType; message: string } {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as any)?.code || '';

  if (code === '42P17' || msg.includes('infinite recursion')) {
    return { type: 'rls', message: 'Family features temporarily unavailable due to a database policy issue.' };
  }
  if (code === '42501' || msg.includes('permission denied')) {
    return { type: 'rls', message: 'Permission denied. Family features are temporarily unavailable.' };
  }
  if (code === '23503' || msg.includes('foreign key') || msg.includes('fkey')) {
    return { type: 'fk', message: 'Family group reference error. Please try again or recreate the group.' };
  }
  if (
    msg.includes('Load failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('Network request failed') ||
    msg.includes('timeout')
  ) {
    return { type: 'network', message: 'Network error. Please check your connection and try again.' };
  }
  return { type: 'unknown', message: msg || 'An unexpected error occurred.' };
}

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useUser();
  const userId = currentUser?.id;

  const [lastError, setLastError] = useState<FamilyErrorType>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [limitedModeDismissed, setLimitedModeDismissed] = useState(false);

  const { data: supabaseFamilyGroups = [], isLoading: familyQueryLoading, isError: familyQueryError, refetch: refetchFamilyGroups } = useSupabaseFamilyGroups(userId);
  const { data: userSettings, isError: settingsQueryError, refetch: refetchSettings } = useSupabaseUserSettings(userId);

  const isLoading = familyQueryLoading && !familyQueryError;
  const isLimitedMode = (familyQueryError || settingsQueryError) && !limitedModeDismissed;

  if (familyQueryError && lastError !== 'rls') {
    console.warn('[FamilyContext] Family groups query failed, operating in limited mode');
  }
  if (settingsQueryError && lastError !== 'rls') {
    console.warn('[FamilyContext] User settings query failed, operating in limited mode');
  }

  const dismissLimitedMode = useCallback(() => {
    setLimitedModeDismissed(true);
  }, []);

  const handleMutationError = useCallback((error: unknown, context: string): never => {
    const classified = classifyError(error);
    console.error(`[FamilyContext] ${context}:`, classified.type, classified.message);
    setLastError(classified.type);
    setLastErrorMessage(classified.message);
    setLimitedModeDismissed(false);
    throw new Error(classified.message);
  }, []);

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
    if (!userId) return;
    try {
      await upsertSettingsMutation.mutateAsync({ view_mode: mode });
      console.log('[FamilyContext] View mode set to:', mode);
      setLastError(null);
      setLastErrorMessage(null);
    } catch (error) {
      handleMutationError(error, 'Error setting view mode');
    }
  }, [userId, upsertSettingsMutation, handleMutationError]);

  const setActiveFamilyGroup = useCallback(async (groupId: string | null) => {
    if (!userId) return;
    try {
      await upsertSettingsMutation.mutateAsync({ active_family_group_id: groupId || undefined });
      const group = groupId ? familyGroups.find(g => g.id === groupId) : null;
      console.log('[FamilyContext] Active family group set to:', group?.name || 'none');
      setLastError(null);
      setLastErrorMessage(null);
    } catch (error) {
      handleMutationError(error, 'Error setting active family group');
    }
  }, [userId, familyGroups, upsertSettingsMutation, handleMutationError]);

  const createFamilyGroup = useCallback(async (group: FamilyGroup): Promise<FamilyGroup> => {
    if (!userId) throw new Error('No user logged in');
    try {
      console.log('[FamilyContext] Creating family group:', group.name);
      const result = await createFamilyGroupMutation.mutateAsync({
        name: group.name,
        member_ids: group.memberIds,
      });
      if (!result?.id || result.id.startsWith('temp_')) {
        throw new Error('Server did not return a valid group ID. Please try again.');
      }
      await refetchFamilyGroups();
      console.log('[FamilyContext] Family group created successfully:', group.name, 'DB id:', result.id);
      setLastError(null);
      setLastErrorMessage(null);
      return convertSupabaseFamilyGroupToFamilyGroup(result);
    } catch (error) {
      return handleMutationError(error, 'Error creating family group');
    }
  }, [userId, createFamilyGroupMutation, refetchFamilyGroups, handleMutationError]);

  const updateFamilyGroup = useCallback(async (updatedGroup: FamilyGroup) => {
    if (!updatedGroup.id || updatedGroup.id.startsWith('temp_')) {
      throw new Error('Cannot update a group without a valid database ID.');
    }
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
      setLastError(null);
      setLastErrorMessage(null);
    } catch (error) {
      handleMutationError(error, 'Error updating family group');
    }
  }, [updateFamilyGroupMutation, refetchFamilyGroups, handleMutationError]);

  const deleteFamilyGroup = useCallback(async (groupId: string) => {
    if (!groupId || groupId.startsWith('temp_')) {
      throw new Error('Cannot delete a group without a valid database ID.');
    }
    try {
      await deleteFamilyGroupMutation.mutateAsync(groupId);

      if (activeFamilyGroup?.id === groupId) {
        try {
          await upsertSettingsMutation.mutateAsync({ active_family_group_id: undefined });
        } catch (settingsErr) {
          console.warn('[FamilyContext] Non-critical: failed to clear active group after delete:', settingsErr);
        }
      }

      await refetchFamilyGroups();
      console.log('[FamilyContext] Family group deleted:', groupId);
      setLastError(null);
      setLastErrorMessage(null);
    } catch (error) {
      handleMutationError(error, 'Error deleting family group');
    }
  }, [deleteFamilyGroupMutation, activeFamilyGroup, upsertSettingsMutation, refetchFamilyGroups, handleMutationError]);

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
    try {
      await refetchFamilyGroups();
      await refetchSettings();
      setLastError(null);
      setLastErrorMessage(null);
      setLimitedModeDismissed(false);
    } catch (error) {
      console.warn('[FamilyContext] Error refreshing family groups:', error);
    }
  }, [refetchFamilyGroups, refetchSettings]);

  const value = useMemo(
    () => ({
      familyGroups,
      activeFamilyGroup,
      viewMode,
      isLoading,
      isLimitedMode,
      lastError,
      lastErrorMessage,
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
      dismissLimitedMode,
    }),
    [
      familyGroups,
      activeFamilyGroup,
      viewMode,
      isLoading,
      isLimitedMode,
      lastError,
      lastErrorMessage,
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
      dismissLimitedMode,
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
