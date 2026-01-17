import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import * as ProfileStorage from '@/storage/profiles';
import * as FamilyStorage from '@/storage/familyGroups';
import { getScanHistory } from '@/storage/scanHistory';
import { getFavorites } from '@/storage/favorites';
import { getShoppingList } from '@/storage/shoppingList';

const MIGRATION_KEY = '@allergy_guardian_supabase_migration_complete';

export async function checkMigrationStatus(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem(MIGRATION_KEY);
    return status === 'true';
  } catch (error) {
    console.error('[Migration] Error checking migration status:', error);
    return false;
  }
}

export async function markMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    console.log('[Migration] Migration marked as complete');
  } catch (error) {
    console.error('[Migration] Error marking migration complete:', error);
  }
}

interface MigrationResult {
  success: boolean;
  profilesMigrated: number;
  familyGroupsMigrated: number;
  scanHistoryMigrated: number;
  favoritesMigrated: number;
  shoppingListMigrated: number;
  errors: string[];
}

export async function migrateToSupabase(userId: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    profilesMigrated: 0,
    familyGroupsMigrated: 0,
    scanHistoryMigrated: 0,
    favoritesMigrated: 0,
    shoppingListMigrated: 0,
    errors: [],
  };

  console.log('[Migration] Starting migration for user:', userId);

  try {
    const alreadyMigrated = await checkMigrationStatus();
    if (alreadyMigrated) {
      console.log('[Migration] Migration already completed, skipping');
      result.success = true;
      return result;
    }

    const localProfiles = await ProfileStorage.getAllProfiles();
    console.log('[Migration] Found', localProfiles.length, 'local profiles');

    const profileIdMap = new Map<string, string>();

    for (const profile of localProfiles) {
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .eq('name', profile.name)
          .single();

        if (existingProfile) {
          console.log('[Migration] Profile already exists:', profile.name);
          profileIdMap.set(profile.id, existingProfile.id);
          continue;
        }

        const { data: newProfile, error } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            name: profile.name,
            relationship: profile.relationship,
            date_of_birth: profile.dateOfBirth,
            allergens: profile.allergens,
            custom_keywords: profile.customKeywords,
            has_anaphylaxis: profile.hasAnaphylaxis,
            emergency_contacts: profile.emergencyContacts,
            medications: profile.medications,
            avatar_color: profile.avatarColor,
          })
          .select('id')
          .single();

        if (error) {
          console.error('[Migration] Error migrating profile:', profile.name, error);
          result.errors.push(`Profile ${profile.name}: ${error.message}`);
        } else if (newProfile) {
          profileIdMap.set(profile.id, newProfile.id);
          result.profilesMigrated++;
          console.log('[Migration] Migrated profile:', profile.name);
        }
      } catch (error) {
        console.error('[Migration] Error processing profile:', profile.name, error);
        result.errors.push(`Profile ${profile.name}: ${error}`);
      }
    }

    const activeProfileId = await ProfileStorage.getActiveProfileId();
    if (activeProfileId && profileIdMap.has(activeProfileId)) {
      const newActiveProfileId = profileIdMap.get(activeProfileId);
      await supabase.from('user_settings').upsert({
        user_id: userId,
        active_profile_id: newActiveProfileId,
        view_mode: 'individual',
      });
      console.log('[Migration] Set active profile');
    }

    const familyGroups = await FamilyStorage.getAllFamilyGroups();
    console.log('[Migration] Found', familyGroups.length, 'family groups');

    for (const group of familyGroups) {
      try {
        const mappedMemberIds = group.memberIds
          .map(oldId => profileIdMap.get(oldId))
          .filter((id): id is string => id !== undefined);

        const { error } = await supabase
          .from('family_groups')
          .insert({
            user_id: userId,
            name: group.name,
            member_ids: mappedMemberIds,
          });

        if (error) {
          console.error('[Migration] Error migrating family group:', group.name, error);
          result.errors.push(`Family group ${group.name}: ${error.message}`);
        } else {
          result.familyGroupsMigrated++;
          console.log('[Migration] Migrated family group:', group.name);
        }
      } catch (error) {
        console.error('[Migration] Error processing family group:', group.name, error);
        result.errors.push(`Family group ${group.name}: ${error}`);
      }
    }

    const scanHistory = await getScanHistory();
    console.log('[Migration] Found', scanHistory.length, 'scan history items');

    for (const item of scanHistory) {
      try {
        const newProfileId = profileIdMap.get(item.profileId);
        if (!newProfileId) {
          console.warn('[Migration] Skipping scan history - profile not found');
          continue;
        }

        const { error } = await supabase
          .from('scan_history')
          .insert({
            user_id: userId,
            profile_id: newProfileId,
            product_code: item.product.code,
            product_name: item.product.product_name,
            verdict: item.verdict?.level || 'safe',
            scanned_at: item.scannedAt,
          });

        if (error) {
          console.error('[Migration] Error migrating scan history:', error);
          result.errors.push(`Scan history: ${error.message}`);
        } else {
          result.scanHistoryMigrated++;
        }
      } catch (error) {
        console.error('[Migration] Error processing scan history:', error);
        result.errors.push(`Scan history: ${error}`);
      }
    }

    const favorites = await getFavorites();
    console.log('[Migration] Found', favorites.length, 'favorites');

    for (const item of favorites) {
      try {
        const newProfileId = profileIdMap.get(item.profileId);
        if (!newProfileId) {
          console.warn('[Migration] Skipping favorite - profile not found');
          continue;
        }

        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: userId,
            profile_id: newProfileId,
            product_code: item.product.code,
            product_name: item.product.product_name,
            added_at: item.addedAt,
          });

        if (error && !error.message.includes('duplicate')) {
          console.error('[Migration] Error migrating favorite:', error);
          result.errors.push(`Favorite: ${error.message}`);
        } else if (!error) {
          result.favoritesMigrated++;
        }
      } catch (error) {
        console.error('[Migration] Error processing favorite:', error);
        result.errors.push(`Favorite: ${error}`);
      }
    }

    const shoppingList = await getShoppingList();
    console.log('[Migration] Found', shoppingList.length, 'shopping list items');

    for (const item of shoppingList) {
      try {
        const { error } = await supabase
          .from('shopping_list')
          .insert({
            user_id: userId,
            product_code: item.barcode,
            product_name: item.name,
            quantity: 1,
            checked: item.checked,
            added_at: item.addedAt,
          });

        if (error) {
          console.error('[Migration] Error migrating shopping list item:', error);
          result.errors.push(`Shopping list: ${error.message}`);
        } else {
          result.shoppingListMigrated++;
        }
      } catch (error) {
        console.error('[Migration] Error processing shopping list item:', error);
        result.errors.push(`Shopping list: ${error}`);
      }
    }

    await markMigrationComplete();
    result.success = true;

    console.log('[Migration] Migration complete:', result);
    return result;
  } catch (error) {
    console.error('[Migration] Fatal error during migration:', error);
    result.errors.push(`Fatal error: ${error}`);
    return result;
  }
}

export async function resetMigrationStatus(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_KEY);
    console.log('[Migration] Migration status reset');
  } catch (error) {
    console.error('[Migration] Error resetting migration status:', error);
  }
}
