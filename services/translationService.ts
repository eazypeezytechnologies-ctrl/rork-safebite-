import { generateObject } from '@rork-ai/toolkit-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

const TRANSLATION_CACHE_PREFIX = 'translation_cache_';
const RATE_LIMIT_KEY = 'translation_rate_limit';
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  isEnglish: boolean;
  confidence: number;
}

interface RateLimitState {
  count: number;
  windowStart: number;
}

const memoryCache = new Map<string, TranslationResult>();

function getCacheKey(text: string): string {
  const trimmed = text.trim().substring(0, 200);
  return TRANSLATION_CACHE_PREFIX + btoa(encodeURIComponent(trimmed)).substring(0, 60);
}

async function checkRateLimit(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();

    if (!raw) {
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: 1, windowStart: now }));
      return true;
    }

    const state: RateLimitState = JSON.parse(raw);

    if (now - state.windowStart > RATE_LIMIT_WINDOW_MS) {
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: 1, windowStart: now }));
      return true;
    }

    if (state.count >= RATE_LIMIT_MAX) {
      console.log('[Translation] Rate limit reached:', state.count, 'requests in window');
      return false;
    }

    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count: state.count + 1, windowStart: state.windowStart }));
    return true;
  } catch {
    return true;
  }
}

async function getCachedTranslation(text: string): Promise<TranslationResult | null> {
  const key = getCacheKey(text);

  const memResult = memoryCache.get(key);
  if (memResult) {
    console.log('[Translation] Memory cache hit');
    return memResult;
  }

  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const result: TranslationResult = JSON.parse(stored);
      memoryCache.set(key, result);
      console.log('[Translation] AsyncStorage cache hit');
      return result;
    }
  } catch (err) {
    console.warn('[Translation] Cache read error:', err);
  }

  return null;
}

async function setCachedTranslation(text: string, result: TranslationResult): Promise<void> {
  const key = getCacheKey(text);
  memoryCache.set(key, result);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(result));
  } catch (err) {
    console.warn('[Translation] Cache write error:', err);
  }
}

function quickIsLikelyEnglish(text: string): boolean {
  if (!text || text.length < 3) return true;

  const sample = text.substring(0, 300);
  const asciiLetters = sample.replace(/[^a-zA-Z]/g, '').length;
  const totalChars = sample.replace(/[\s\d,.\-;:()[\]{}'"!?/\\@#$%^&*+=<>~`]/g, '').length;

  if (totalChars === 0) return true;

  const asciiRatio = asciiLetters / totalChars;

  if (asciiRatio < 0.5) return false;

  const commonEnglishWords = /\b(the|and|of|to|in|is|it|that|for|with|as|was|on|are|at|be|this|have|from|or|an|but|not|by|one|had|all|can|her|has|been|if|its|may|will|each|about|how|up|out|them|than|only|into|some|could|other|do|no|time|very|when|your|more|also|which|would|there|their)\b/gi;
  const matches = sample.match(commonEnglishWords);

  if (matches && matches.length >= 2) return true;

  const nonLatinPattern = /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u3000-\u9FFF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\u0900-\u097F\u0980-\u09FF\u0E00-\u0E7F\u1000-\u109F]/;
  if (nonLatinPattern.test(sample)) return false;

  return asciiRatio > 0.85;
}

const translationSchema = z.object({
  detectedLanguage: z.string().describe('ISO 639-1 language code or full language name'),
  isEnglish: z.boolean().describe('Whether the text is already in English'),
  confidence: z.number().min(0).max(1).describe('Confidence of language detection 0-1'),
  translatedText: z.string().describe('English translation of the text. If already English, return the original text unchanged'),
});

export async function translateText(text: string): Promise<TranslationResult> {
  if (!text || text.trim().length === 0) {
    return {
      originalText: text,
      translatedText: text,
      detectedLanguage: 'en',
      isEnglish: true,
      confidence: 1,
    };
  }

  const cached = await getCachedTranslation(text);
  if (cached) return cached;

  if (quickIsLikelyEnglish(text)) {
    const result: TranslationResult = {
      originalText: text,
      translatedText: text,
      detectedLanguage: 'en',
      isEnglish: true,
      confidence: 0.85,
    };
    await setCachedTranslation(text, result);
    return result;
  }

  const allowed = await checkRateLimit();
  if (!allowed) {
    console.warn('[Translation] Rate limited, returning original text');
    return {
      originalText: text,
      translatedText: text,
      detectedLanguage: 'unknown',
      isEnglish: false,
      confidence: 0,
    };
  }

  try {
    console.log('[Translation] Requesting AI translation for:', text.substring(0, 80));

    const truncated = text.substring(0, 2000);

    const response = await generateObject({
      messages: [
        {
          role: 'user',
          content: `Detect the language and translate the following text to English. If it is already English, return it as-is. Keep ingredient names accurate and preserve formatting.\n\nText:\n${truncated}`,
        },
      ],
      schema: translationSchema,
    });

    const result: TranslationResult = {
      originalText: text,
      translatedText: response.translatedText,
      detectedLanguage: response.detectedLanguage,
      isEnglish: response.isEnglish,
      confidence: response.confidence,
    };

    await setCachedTranslation(text, result);
    console.log('[Translation] Success - detected:', result.detectedLanguage, 'isEnglish:', result.isEnglish);
    return result;
  } catch (error) {
    console.error('[Translation] AI translation error:', error);
    return {
      originalText: text,
      translatedText: text,
      detectedLanguage: 'unknown',
      isEnglish: false,
      confidence: 0,
    };
  }
}

export async function translateMultiple(texts: Record<string, string>): Promise<Record<string, TranslationResult>> {
  const results: Record<string, TranslationResult> = {};

  const entries = Object.entries(texts).filter(([, v]) => v && v.trim().length > 0);

  await Promise.all(
    entries.map(async ([key, value]) => {
      results[key] = await translateText(value);
    })
  );

  return results;
}

export function isTranslationAvailable(result: TranslationResult): boolean {
  return !result.isEnglish && result.confidence > 0 && result.translatedText !== result.originalText;
}

export type { TranslationResult };
