import AsyncStorage from '@react-native-async-storage/async-storage';
import { VerdictLevel } from '@/types';

export interface AIVerdictRecord {
  productCode: string;
  profileId: string;
  aiVerdict: VerdictLevel;
  aiSummary: string;
  aiConfidence: 'high' | 'medium' | 'low';
  hasConflict: boolean;
  conflictReason?: string;
  updatedAt: string;
}

const AI_VERDICT_KEY = '@safebite_ai_verdicts';

function getStorageKey(userId?: string): string {
  return userId ? `${AI_VERDICT_KEY}_${userId}` : AI_VERDICT_KEY;
}

function getRecordKey(productCode: string, profileId: string): string {
  return `${productCode}:${profileId}`;
}

export async function getAIVerdict(
  productCode: string,
  profileId: string,
  userId?: string
): Promise<AIVerdictRecord | null> {
  try {
    const key = getStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;

    const records: Record<string, AIVerdictRecord> = JSON.parse(data);
    const recordKey = getRecordKey(productCode, profileId);
    return records[recordKey] || null;
  } catch (error) {
    console.error('[AIVerdict] Error reading AI verdict:', error);
    return null;
  }
}

export async function saveAIVerdict(
  record: AIVerdictRecord,
  userId?: string
): Promise<void> {
  try {
    const key = getStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    const records: Record<string, AIVerdictRecord> = data ? JSON.parse(data) : {};

    const recordKey = getRecordKey(record.productCode, record.profileId);
    records[recordKey] = record;

    await AsyncStorage.setItem(key, JSON.stringify(records));
    console.log('[AIVerdict] Saved AI verdict for', record.productCode, '→', record.aiVerdict);
  } catch (error) {
    console.error('[AIVerdict] Error saving AI verdict:', error);
  }
}

export async function clearAIVerdict(
  productCode: string,
  profileId: string,
  userId?: string
): Promise<void> {
  try {
    const key = getStorageKey(userId);
    const data = await AsyncStorage.getItem(key);
    if (!data) return;

    const records: Record<string, AIVerdictRecord> = JSON.parse(data);
    const recordKey = getRecordKey(productCode, profileId);
    delete records[recordKey];

    await AsyncStorage.setItem(key, JSON.stringify(records));
    console.log('[AIVerdict] Cleared AI verdict for', productCode);
  } catch (error) {
    console.error('[AIVerdict] Error clearing AI verdict:', error);
  }
}

export function parseAIVerdictFromText(analysisText: string): {
  verdict: VerdictLevel;
  confidence: 'high' | 'medium' | 'low';
} {
  const upperText = analysisText.toUpperCase();

  const safePatterns = [
    /\bSAFETY\s*ASSESSMENT\s*[:\.]*\s*SAFE\b/,
    /\bASSESSMENT\s*[:\.]*\s*SAFE\b/,
    /\b1\.\s*.*?SAFE\b/,
    /\bVERDICT\s*[:\.]*\s*SAFE\b/,
    /\bRATING\s*[:\.]*\s*SAFE\b/,
    /\bSTATUS\s*[:\.]*\s*SAFE\b/,
    /\bIS\s+SAFE\s+FOR\b/,
    /\bAPPEARS?\s+SAFE\b/,
    /\bLIKELY\s+SAFE\b/,
    /\bSAFE\s+TO\s+(USE|CONSUME|EAT)\b/,
  ];

  const dangerPatterns = [
    /\bSAFETY\s*ASSESSMENT\s*[:\.]*\s*DANGER\b/,
    /\bASSESSMENT\s*[:\.]*\s*DANGER\b/,
    /\b1\.\s*.*?DANGER\b/,
    /\bVERDICT\s*[:\.]*\s*DANGER\b/,
    /\bNOT\s+SAFE\b/,
    /\bUNSAFE\b/,
    /\bAVOID\s+THIS\s+PRODUCT\b/,
    /\bDO\s+NOT\s+(USE|CONSUME|EAT)\b/,
    /\bCONTAINS\s+ALLERGEN/,
    /\bDANGEROUS\b/,
  ];

  const cautionPatterns = [
    /\bSAFETY\s*ASSESSMENT\s*[:\.]*\s*CAUTION\b/,
    /\bASSESSMENT\s*[:\.]*\s*CAUTION\b/,
    /\b1\.\s*.*?CAUTION\b/,
    /\bVERDICT\s*[:\.]*\s*CAUTION\b/,
    /\bUSE\s+WITH\s+CAUTION\b/,
    /\bCROSS[- ]?CONTAMINAT/,
    /\bMAY\s+CONTAIN\s+TRACES\b/,
    /\bEXERCISE\s+CAUTION\b/,
  ];

  const hasDanger = dangerPatterns.some(p => p.test(upperText));
  const hasCaution = cautionPatterns.some(p => p.test(upperText));
  const hasSafe = safePatterns.some(p => p.test(upperText));

  if (hasDanger && !hasSafe) {
    return { verdict: 'danger', confidence: 'high' };
  }

  if (hasCaution && !hasSafe && !hasDanger) {
    return { verdict: 'caution', confidence: 'medium' };
  }

  if (hasSafe && !hasDanger) {
    return { verdict: 'safe', confidence: hasCaution ? 'medium' : 'high' };
  }

  if (hasSafe && hasDanger) {
    return { verdict: 'caution', confidence: 'low' };
  }

  return { verdict: 'caution', confidence: 'low' };
}
