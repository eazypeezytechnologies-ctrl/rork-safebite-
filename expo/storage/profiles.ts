import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '@/types';

const PROFILES_KEY = '@allergy_guardian_profiles';
const ACTIVE_PROFILE_KEY = '@allergy_guardian_active_profile';

async function getItem(key: string): Promise<string | null> {
  return await AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

async function deleteItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function getAllProfiles(): Promise<Profile[]> {
  try {
    const data = await getItem(PROFILES_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading profiles:', error);
    return [];
  }
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  try {
    await setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error('Error saving profiles:', error);
    throw error;
  }
}

export async function addProfile(profile: Profile): Promise<void> {
  console.log('ProfileStorage: Adding profile to storage:', profile.name);
  const profiles = await getAllProfiles();
  console.log('ProfileStorage: Current profiles count:', profiles.length);
  profiles.push(profile);
  console.log('ProfileStorage: New profiles count:', profiles.length);
  await saveProfiles(profiles);
  console.log('ProfileStorage: Profile saved successfully');
}

export async function updateProfile(updatedProfile: Profile): Promise<void> {
  const profiles = await getAllProfiles();
  const index = profiles.findIndex(p => p.id === updatedProfile.id);
  if (index !== -1) {
    profiles[index] = updatedProfile;
    await saveProfiles(profiles);
  }
}

export async function deleteProfile(profileId: string): Promise<void> {
  const profiles = await getAllProfiles();
  const filtered = profiles.filter(p => p.id !== profileId);
  await saveProfiles(filtered);
  
  const activeId = await getActiveProfileId();
  if (activeId === profileId) {
    if (filtered.length > 0) {
      await setActiveProfileId(filtered[0].id);
    } else {
      await deleteItem(ACTIVE_PROFILE_KEY);
    }
  }
}

export async function getActiveProfileId(): Promise<string | null> {
  try {
    return await getItem(ACTIVE_PROFILE_KEY);
  } catch (error) {
    console.error('Error loading active profile ID:', error);
    return null;
  }
}

export async function setActiveProfileId(profileId: string): Promise<void> {
  try {
    console.log('ProfileStorage: Setting active profile ID:', profileId);
    await setItem(ACTIVE_PROFILE_KEY, profileId);
    console.log('ProfileStorage: Active profile ID saved');
  } catch (error) {
    console.error('Error saving active profile ID:', error);
    throw error;
  }
}

export async function getActiveProfile(): Promise<Profile | null> {
  const activeId = await getActiveProfileId();
  if (!activeId) return null;
  
  const profiles = await getAllProfiles();
  return profiles.find(p => p.id === activeId) || null;
}

export async function clearAllData(): Promise<void> {
  try {
    await deleteItem(PROFILES_KEY);
    await deleteItem(ACTIVE_PROFILE_KEY);
    console.log('All data cleared from storage');
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
}
