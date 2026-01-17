import AsyncStorage from '@react-native-async-storage/async-storage';
import { FamilyGroup } from '@/types';

const FAMILY_GROUPS_KEY = '@allergy_guardian_family_groups';
const ACTIVE_FAMILY_KEY = '@allergy_guardian_active_family';

export async function getAllFamilyGroups(): Promise<FamilyGroup[]> {
  try {
    const data = await AsyncStorage.getItem(FAMILY_GROUPS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading family groups:', error);
    return [];
  }
}

export async function saveFamilyGroups(groups: FamilyGroup[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAMILY_GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Error saving family groups:', error);
    throw error;
  }
}

export async function createFamilyGroup(group: FamilyGroup): Promise<void> {
  console.log('FamilyStorage: Creating family group:', group.name);
  const groups = await getAllFamilyGroups();
  groups.push(group);
  await saveFamilyGroups(groups);
  console.log('FamilyStorage: Family group saved successfully');
}

export async function updateFamilyGroup(updatedGroup: FamilyGroup): Promise<void> {
  const groups = await getAllFamilyGroups();
  const index = groups.findIndex(g => g.id === updatedGroup.id);
  if (index !== -1) {
    groups[index] = updatedGroup;
    await saveFamilyGroups(groups);
  }
}

export async function deleteFamilyGroup(groupId: string): Promise<void> {
  const groups = await getAllFamilyGroups();
  const filtered = groups.filter(g => g.id !== groupId);
  await saveFamilyGroups(filtered);
  
  const activeId = await getActiveFamilyGroupId();
  if (activeId === groupId) {
    await AsyncStorage.removeItem(ACTIVE_FAMILY_KEY);
  }
}

export async function getActiveFamilyGroupId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_FAMILY_KEY);
  } catch (error) {
    console.error('Error loading active family group ID:', error);
    return null;
  }
}

export async function setActiveFamilyGroupId(groupId: string | null): Promise<void> {
  try {
    if (groupId) {
      console.log('FamilyStorage: Setting active family group ID:', groupId);
      await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, groupId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_FAMILY_KEY);
    }
    console.log('FamilyStorage: Active family group ID saved');
  } catch (error) {
    console.error('Error saving active family group ID:', error);
    throw error;
  }
}

export async function getActiveFamilyGroup(): Promise<FamilyGroup | null> {
  const activeId = await getActiveFamilyGroupId();
  if (!activeId) return null;
  
  const groups = await getAllFamilyGroups();
  return groups.find(g => g.id === activeId) || null;
}
