import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

const USERS_KEY = '@allergy_guardian_users';
const CURRENT_USER_KEY = '@allergy_guardian_current_user';
const ONBOARDING_KEY = '@allergy_guardian_onboarding_complete';

async function getItem(key: string): Promise<string | null> {
  return await AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

async function deleteItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const data = await getItem(USERS_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.error('Invalid users data structure, resetting...');
      await setItem(USERS_KEY, JSON.stringify([]));
      return [];
    }
    
    return parsed;
  } catch (error) {
    console.error('Error loading users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Details:', errorMessage);
    
    await setItem(USERS_KEY, JSON.stringify([]));
    return [];
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  try {
    await setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Error saving users:', error);
    throw error;
  }
}

export async function addUser(user: User): Promise<void> {
  const users = await getAllUsers();
  users.push(user);
  await saveUsers(users);
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const data = await getItem(CURRENT_USER_KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || !parsed.id) {
      console.error('Invalid current user data structure, clearing...');
      await deleteItem(CURRENT_USER_KEY);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error loading current user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Details:', errorMessage);
    
    await deleteItem(CURRENT_USER_KEY);
    return null;
  }
}

export async function setCurrentUser(user: User): Promise<void> {
  try {
    await setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving current user:', error);
    throw error;
  }
}

export async function clearCurrentUser(): Promise<void> {
  try {
    await deleteItem(CURRENT_USER_KEY);
  } catch (error) {
    console.error('Error clearing current user:', error);
    throw error;
  }
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const data = await getItem(ONBOARDING_KEY);
    return data === 'true';
  } catch (error) {
    console.error('Error checking onboarding:', error);
    return false;
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    await setItem(ONBOARDING_KEY, 'true');
  } catch (error) {
    console.error('Error setting onboarding complete:', error);
    throw error;
  }
}

export async function updateUserPassword(email: string, newPassword: string): Promise<void> {
  try {
    const users = await getAllUsers();
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    users[userIndex].password = newPassword;
    await saveUsers(users);
    
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.email === email) {
      currentUser.password = newPassword;
      await setCurrentUser(currentUser);
    }
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const users = await getAllUsers();
    return users.find(u => u.email === email) || null;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  try {
    const users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    users[userIndex] = { ...users[userIndex], ...updates };
    await saveUsers(users);
    
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      const updatedUser = { ...currentUser, ...updates };
      await setCurrentUser(updatedUser);
    }
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

export async function deleteUser(userId: string): Promise<void> {
  try {
    const users = await getAllUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    await saveUsers(filteredUsers);
    
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      await clearCurrentUser();
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function clearAllUserData(): Promise<void> {
  try {
    await deleteItem(USERS_KEY);
    await deleteItem(CURRENT_USER_KEY);
    await deleteItem(ONBOARDING_KEY);
    console.log('All user data cleared from storage');
  } catch (error) {
    console.error('Error clearing all user data:', error);
    throw error;
  }
}
