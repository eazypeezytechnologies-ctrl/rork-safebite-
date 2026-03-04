import AsyncStorage from '@react-native-async-storage/async-storage';

const TRUSTED_PRODUCTS_KEY = '@safebite_trusted_products';

export interface TrustedProduct {
  productCode: string;
  profileId: string;
  trustedAt: string;
  reason?: string;
}

function getStorageKey(userId?: string): string {
  return userId ? `${TRUSTED_PRODUCTS_KEY}_${userId}` : TRUSTED_PRODUCTS_KEY;
}

function getRecordKey(productCode: string, profileId: string): string {
  return `${productCode}:${profileId}`;
}

export async function getTrustedProduct(
  productCode: string,
  profileId: string,
  userId?: string
): Promise<TrustedProduct | null> {
  try {
    const key = getStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;

    const records: Record<string, TrustedProduct> = JSON.parse(data);
    const recordKey = getRecordKey(productCode, profileId);
    return records[recordKey] || null;
  } catch (error) {
    console.error('[TrustedProducts] Error reading:', error);
    return null;
  }
}

export async function markProductTrusted(
  productCode: string,
  profileId: string,
  userId?: string,
  reason?: string
): Promise<void> {
  try {
    const key = getStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    const records: Record<string, TrustedProduct> = data ? JSON.parse(data) : {};

    const recordKey = getRecordKey(productCode, profileId);
    records[recordKey] = {
      productCode,
      profileId,
      trustedAt: new Date().toISOString(),
      reason,
    };

    await AsyncStorage.setItem(key, JSON.stringify(records));
    console.log('[TrustedProducts] Marked trusted:', productCode, 'for profile:', profileId);
  } catch (error) {
    console.error('[TrustedProducts] Error saving:', error);
  }
}

export async function removeTrustedProduct(
  productCode: string,
  profileId: string,
  userId?: string
): Promise<void> {
  try {
    const key = getStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return;

    const records: Record<string, TrustedProduct> = JSON.parse(data);
    const recordKey = getRecordKey(productCode, profileId);
    delete records[recordKey];

    await AsyncStorage.setItem(key, JSON.stringify(records));
    console.log('[TrustedProducts] Removed trust:', productCode, 'for profile:', profileId);
  } catch (error) {
    console.error('[TrustedProducts] Error removing:', error);
  }
}
