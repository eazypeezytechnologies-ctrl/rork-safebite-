import { Platform } from 'react-native';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const HEX = '0123456789abcdef';

export function generateSecureToken(length: number = 48): string {
  const array = new Uint8Array(length);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  let token = '';
  for (let i = 0; i < length; i++) {
    token += CHARS[array[i] % CHARS.length];
  }
  return token;
}

export async function hashToken(token: string): Promise<string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => HEX[b >> 4] + HEX[b & 0x0f]).join('');
    } catch (e) {
      console.warn('[Security] Web crypto hash failed, using fallback:', e);
    }
  }
  return simpleHash(token);
}

function simpleHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (combined >>> 0).toString(16).padStart(8, '0');
  return hex1 + hex2 + hex3 + hex1.split('').reverse().join('') + hex2.split('').reverse().join('');
}

export function normalizeBarcode(code: string): string {
  return code.trim().replace(/[^0-9a-zA-Z-]/g, '');
}

export function sanitizeInput(input: string, maxLength: number = 500): string {
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '');
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320;
}

export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function validateFamilyMemberCount(currentCount: number, maxMembers: number = 6): { valid: boolean; message: string } {
  if (currentCount >= maxMembers) {
    return { valid: false, message: `Family group is full (${maxMembers} members max)` };
  }
  return { valid: true, message: '' };
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function getExpirationDate(hoursFromNow: number = 72): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const visibleChars = Math.min(2, local.length);
  return local.substring(0, visibleChars) + '***@' + domain;
}

export function maskUserId(userId: string): string {
  if (userId.length <= 8) return '****';
  return userId.substring(0, 4) + '****' + userId.substring(userId.length - 4);
}
