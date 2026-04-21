import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ViewMode } from '@/types';

export interface SupabaseProfile {
  id: string;
  user_id: string;
  name: string;
  relationship?: string;
  date_of_birth?: string;
  allergens: string[];
  custom_keywords: string[];
  has_anaphylaxis: boolean;
  emergency_contacts: {
    name: string;
    phone: string;
    relationship: string;
  }[];
  medications: string[];
  avatar_color?: string;
  track_eczema_triggers?: boolean;
  eczema_trigger_groups?: string[];
  dietary_rules?: string[];
  avoid_ingredients?: string[];
  dietary_restrictions?: Record<string, boolean>;
  dietary_strictness?: Record<string, string>;
  health_items?: any[];
  created_at: string;
  updated_at: string;
}

export interface SupabaseScanHistory {
  id: string;
  user_id: string;
  profile_id: string;
  product_code: string;
  product_name?: string;
  verdict: 'safe' | 'caution' | 'danger';
  scanned_at: string;
  location?: { latitude: number; longitude: number };
}

export interface SupabaseFavorite {
  id: string;
  user_id: string;
  profile_id: string;
  product_code: string;
  product_name?: string;
  added_at: string;
}

export interface SupabaseShoppingListItem {
  id: string;
  user_id: string;
  product_code?: string;
  product_name: string;
  quantity: number;
  checked: boolean;
  added_at: string;
  updated_at: string;
}

export interface SupabaseFamilyGroup {
  id: string;
  user_id: string;
  name: string;
  member_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface SupabaseUserSettings {
  user_id: string;
  active_profile_id?: string;
  active_family_group_id?: string;
  view_mode: ViewMode;
  updated_at: string;
}

export function useSupabaseProfiles(userId?: string) {
  return useQuery({
    queryKey: ['supabase-profiles', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useSupabaseProfiles] Error:', error);
        throw error;
      }

      return data as SupabaseProfile[];
    },
    enabled: !!userId,
  });
}

export function useCreateProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: Omit<SupabaseProfile, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          ...profile,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('[useCreateProfile] Error:', error);
        throw error;
      }

      return data as SupabaseProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-profiles', userId] });
    },
  });
}

const CORE_PROFILE_COLUMNS = new Set([
  'name', 'relationship', 'date_of_birth', 'allergens', 'custom_keywords',
  'has_anaphylaxis', 'emergency_contacts', 'medications', 'avatar_color',
]);

const OPTIONAL_PROFILE_COLUMNS = new Set([
  'dietary_rules', 'avoid_ingredients', 'track_eczema_triggers',
  'eczema_trigger_groups', 'dietary_restrictions', 'dietary_strictness',
  'health_items',
]);

const ALWAYS_SAFE_PROFILE_COLUMNS = [
  'name', 'relationship', 'date_of_birth', 'allergens', 'custom_keywords',
  'has_anaphylaxis', 'emergency_contacts', 'medications', 'avatar_color',
];

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SupabaseProfile> }) => {
      const sanitized: Record<string, any> = {};
      const optional: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (CORE_PROFILE_COLUMNS.has(key)) {
          sanitized[key] = value;
        } else if (OPTIONAL_PROFILE_COLUMNS.has(key)) {
          optional[key] = value;
        }
      }

      if (Object.keys(sanitized).length === 0) {
        console.warn('[useUpdateProfile] No valid fields to update');
        const { data: existing } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();
        return existing as SupabaseProfile;
      }

      console.log('[useUpdateProfile] Updating profile', id, 'with core fields:', Object.keys(sanitized).join(', '));

      const fullPayload = { ...sanitized, ...optional };
      let { data, error } = await supabase
        .from('profiles')
        .update(fullPayload)
        .eq('id', id)
        .select()
        .single();

      if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message || '').toLowerCase().includes('column'))) {
        console.warn('[useUpdateProfile] Full payload failed, retrying with core-only fields:', error.message || error.code);
        const coreRetry = await supabase
          .from('profiles')
          .update(sanitized)
          .eq('id', id)
          .select()
          .single();
        data = coreRetry.data;
        error = coreRetry.error;
      }

      if (error) {
        console.warn('[useUpdateProfile] Initial update failed (logged, will retry):', error.message || error.code);

        if (error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703') {
          console.log('[useUpdateProfile] Retrying with always-safe fields only...');
          const coreOnly: Record<string, any> = {};
          for (const col of ALWAYS_SAFE_PROFILE_COLUMNS) {
            if (sanitized[col] !== undefined) {
              coreOnly[col] = sanitized[col];
            }
          }

          if (Object.keys(coreOnly).length === 0) {
            console.log('[useUpdateProfile] No always-safe fields to update, returning existing profile silently');
            const { data: existing } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', id)
              .single();
            return existing as SupabaseProfile;
          }

          const { data: retryData, error: retryError } = await supabase
            .from('profiles')
            .update(coreOnly)
            .eq('id', id)
            .select()
            .single();

          if (retryError) {
            console.warn('[useUpdateProfile] Retry also failed, returning existing profile silently:', retryError.message || retryError.code);
            const { data: existing } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', id)
              .single();
            return existing as SupabaseProfile;
          }
          return retryData as SupabaseProfile;
        }

        throw error;
      }

      return data as SupabaseProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-profiles', userId] });
    },
  });
}

export function useDeleteProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useDeleteProfile] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-profiles', userId] });
    },
  });
}

export function useSupabaseScanHistory(userId?: string) {
  return useQuery({
    queryKey: ['supabase-scan-history', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', userId)
        .order('scanned_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[useSupabaseScanHistory] Error:', error);
        throw error;
      }

      return data;
    },
    enabled: !!userId,
  });
}

export function useAddScanHistory(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scan: {
      profile_id: string;
      product_code: string;
      product_name?: string;
      verdict: 'safe' | 'caution' | 'danger';
      location?: { latitude: number; longitude: number };
    }) => {
      const { data, error } = await supabase
        .from('scan_history')
        .insert({
          user_id: userId,
          ...scan,
          scanned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[useAddScanHistory] Error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-scan-history', userId] });
    },
  });
}

export function useRemoveScanHistory(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scan_history')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useRemoveScanHistory] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-scan-history', userId] });
    },
  });
}

export function useSupabaseProduct(code: string) {
  return useQuery({
    queryKey: ['supabase-product', code],
    queryFn: async () => {
      if (!code) return null;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('code', code)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[useSupabaseProduct] Error:', error);
        throw error;
      }

      return data;
    },
    enabled: !!code,
  });
}

export function useUpsertProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: {
      code: string;
      product_name?: string;
      brands?: string;
      image_url?: string;
      image_front_url?: string;
      ingredients_text?: string;
      allergens?: string;
      allergens_tags?: string[];
      traces?: string;
      traces_tags?: string[];
      categories?: string;
      categories_tags?: string[];
      source: string;
      scan_count?: number;
    }) => {
      const { data, error } = await supabase
        .from('products')
        .upsert({
          ...product,
          cached_at: new Date().toISOString(),
          last_fetched_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[useUpsertProduct] Error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supabase-product', data.code] });
    },
  });
}

export function useSupabaseFavorites(userId?: string, profileId?: string) {
  return useQuery({
    queryKey: ['supabase-favorites', userId, profileId],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('favorites')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useSupabaseFavorites] Error:', error);
        throw error;
      }

      return data as SupabaseFavorite[];
    },
    enabled: !!userId,
  });
}

export function useAddFavorite(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (favorite: {
      profile_id: string;
      product_code: string;
      product_name?: string;
    }) => {
      const { data, error } = await supabase
        .from('favorites')
        .insert({
          user_id: userId,
          ...favorite,
        })
        .select()
        .single();

      if (error) {
        console.error('[useAddFavorite] Error:', error);
        throw error;
      }

      return data as SupabaseFavorite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-favorites', userId] });
    },
  });
}

export function useRemoveFavorite(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useRemoveFavorite] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-favorites', userId] });
    },
  });
}

export function useSupabaseShoppingList(userId?: string) {
  return useQuery({
    queryKey: ['supabase-shopping-list', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      if (error) {
        console.error('[useSupabaseShoppingList] Error:', error);
        throw error;
      }

      return data as SupabaseShoppingListItem[];
    },
    enabled: !!userId,
  });
}

export function useAddShoppingListItem(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      product_code?: string;
      product_name: string;
      quantity?: number;
    }) => {
      const { data, error } = await supabase
        .from('shopping_list')
        .insert({
          user_id: userId,
          ...item,
          quantity: item.quantity || 1,
          checked: false,
        })
        .select()
        .single();

      if (error) {
        console.error('[useAddShoppingListItem] Error:', error);
        throw error;
      }

      return data as SupabaseShoppingListItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-shopping-list', userId] });
    },
  });
}

export function useUpdateShoppingListItem(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SupabaseShoppingListItem> }) => {
      const { data, error } = await supabase
        .from('shopping_list')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[useUpdateShoppingListItem] Error:', error);
        throw error;
      }

      return data as SupabaseShoppingListItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-shopping-list', userId] });
    },
  });
}

export function useRemoveShoppingListItem(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useRemoveShoppingListItem] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-shopping-list', userId] });
    },
  });
}

export function useClearCheckedShoppingItems(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('user_id', userId)
        .eq('checked', true);

      if (error) {
        console.error('[useClearCheckedShoppingItems] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-shopping-list', userId] });
    },
  });
}

export function useSupabaseFamilyGroups(userId?: string) {
  return useQuery({
    queryKey: ['supabase-family-groups', userId],
    queryFn: async () => {
      if (!userId) return [];

      try {
        const { data, error } = await supabase
          .from('family_groups')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (error) {
          if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
            console.warn('[useSupabaseFamilyGroups] RLS policy recursion detected, returning empty. This is a Supabase RLS config issue.');
            return [] as SupabaseFamilyGroup[];
          }
          if (error.code === '42501') {
            console.warn('[useSupabaseFamilyGroups] Permission denied, returning empty.');
            return [] as SupabaseFamilyGroup[];
          }
          console.error('[useSupabaseFamilyGroups] Error:', error);
          return [] as SupabaseFamilyGroup[];
        }

        return (data ?? []) as SupabaseFamilyGroup[];
      } catch (e) {
        console.warn('[useSupabaseFamilyGroups] Unexpected error, returning empty:', e);
        return [] as SupabaseFamilyGroup[];
      }
    },
    enabled: !!userId,
    retry: false,
  });
}

export function useCreateFamilyGroup(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (group: { name: string; member_ids: string[] }) => {
      const { data, error } = await supabase
        .from('family_groups')
        .insert({
          user_id: userId,
          ...group,
        })
        .select()
        .single();

      if (error) {
        console.error('[useCreateFamilyGroup] Error:', error);
        throw error;
      }

      return data as SupabaseFamilyGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-family-groups', userId] });
    },
  });
}

export function useUpdateFamilyGroup(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SupabaseFamilyGroup> }) => {
      const { data, error } = await supabase
        .from('family_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[useUpdateFamilyGroup] Error:', error);
        throw error;
      }

      return data as SupabaseFamilyGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-family-groups', userId] });
    },
  });
}

export function useDeleteFamilyGroup(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('family_groups')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useDeleteFamilyGroup] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-family-groups', userId] });
    },
  });
}

export interface SupabaseProfileDocument {
  id: string;
  user_id: string;
  profile_id: string;
  file_path: string;
  file_type: string;
  title: string | null;
  created_at: string;
}

export function useSupabaseProfileDocuments(userId?: string, profileId?: string) {
  return useQuery({
    queryKey: ['supabase-profile-documents', userId, profileId],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('profile_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useSupabaseProfileDocuments] Error:', error);
        throw error;
      }

      return data as SupabaseProfileDocument[];
    },
    enabled: !!userId,
  });
}

export function useCreateProfileDocument(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: {
      profile_id: string;
      file_path: string;
      file_type: string;
      title?: string;
    }) => {
      const { data, error } = await supabase
        .from('profile_documents')
        .insert({
          user_id: userId,
          ...doc,
        })
        .select()
        .single();

      if (error) {
        console.error('[useCreateProfileDocument] Error:', error);
        throw error;
      }

      return data as SupabaseProfileDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-profile-documents', userId] });
    },
  });
}

export function useDeleteProfileDocument(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      const { error: storageError } = await supabase.storage
        .from('profile-documents')
        .remove([filePath]);

      if (storageError) {
        console.warn('[useDeleteProfileDocument] Storage delete error (non-fatal):', storageError);
      }

      const { error } = await supabase
        .from('profile_documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[useDeleteProfileDocument] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-profile-documents', userId] });
    },
  });
}

export function useUploadProfileDocument(userId: string) {
  return useMutation({
    mutationFn: async ({
      fileUri,
      fileName,
      fileType,
    }: {
      fileUri: string;
      fileName: string;
      fileType: string;
    }) => {
      const filePath = `${userId}/${Date.now()}_${fileName}`;

      const response = await fetch(fileUri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('profile-documents')
        .upload(filePath, blob, {
          contentType: fileType,
          upsert: false,
        });

      if (error) {
        console.error('[useUploadProfileDocument] Upload error:', error);
        throw error;
      }

      console.log('[useUploadProfileDocument] Uploaded to:', data.path);
      return data.path;
    },
  });
}

export function useSupabaseUserSettings(userId?: string) {
  return useQuery({
    queryKey: ['supabase-user-settings', userId],
    queryFn: async () => {
      if (!userId) return null;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return null;
          if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
            console.warn('[useSupabaseUserSettings] RLS policy recursion detected, returning null.');
            return null;
          }
          if (error.code === '42501') {
            console.warn('[useSupabaseUserSettings] Permission denied, returning null.');
            return null;
          }
          console.error('[useSupabaseUserSettings] Error:', error);
          return null;
        }

        return data as SupabaseUserSettings | null;
      } catch (e) {
        console.warn('[useSupabaseUserSettings] Unexpected error:', e);
        return null;
      }
    },
    enabled: !!userId,
    retry: false,
  });
}

export function useUpsertUserSettings(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<SupabaseUserSettings>) => {
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settings,
        })
        .select()
        .single();

      if (error) {
        console.error('[useUpsertUserSettings] Error:', error.message || error.code || JSON.stringify(error));
        throw error;
      }

      return data as SupabaseUserSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-user-settings', userId] });
    },
  });
}
