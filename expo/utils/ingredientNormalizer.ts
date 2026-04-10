import { CANONICAL_INGREDIENTS, CanonicalIngredient } from '@/constants/ingredientAliases';
import { ECZEMA_TRIGGERS, EczemaTrigger } from '@/constants/eczemaTriggers';
import { FOOD_SENSITIVITY_TRIGGERS, FoodSensitivityTrigger } from '@/constants/sensitivityTriggers';
import {
  SCIENTIFIC_ALLERGEN_DATABASE,
  AllergenDefinition,
} from '@/constants/scientificAllergenDatabase';

export type AliasType =
  | 'direct'
  | 'hidden_name'
  | 'derivative'
  | 'scientific_name'
  | 'inci'
  | 'e_number'
  | 'common_name'
  | 'eczema_alias'
  | 'sensitivity_keyword'
  | 'none';

export type MatchStatus = 'matched' | 'partial' | 'unmatched';

export type MatchConfidence = 'high' | 'medium' | 'low';

export type IngredientDomain =
  | 'food_allergen'
  | 'eczema_trigger'
  | 'food_sensitivity'
  | 'additive'
  | 'preservative'
  | 'emulsifier'
  | 'unknown';

export interface NormalizedIngredient {
  raw: string;
  normalized: string;
  canonical: string | null;
  matchStatus: MatchStatus;
  aliasType: AliasType;
  matchConfidence: MatchConfidence;
  domain: IngredientDomain;
  riskLevel: string | null;
  notes: string | null;
}

export interface ParsedIngredientList {
  raw: string;
  ingredients: NormalizedIngredient[];
  totalCount: number;
  matchedCount: number;
  unmatchedCount: number;
  partialCount: number;
  parseWarnings: string[];
}

interface AliasEntry {
  canonical: string;
  aliasType: AliasType;
  domain: IngredientDomain;
  riskLevel: string | null;
  notes: string | null;
}

let aliasLookupCache: Map<string, AliasEntry> | null = null;

function buildAliasLookup(): Map<string, AliasEntry> {
  if (aliasLookupCache) return aliasLookupCache;

  console.log('[IngredientNormalizer] Building alias lookup table...');
  const lookup = new Map<string, AliasEntry>();

  for (const entry of CANONICAL_INGREDIENTS) {
    const domain = categoryToDomain(entry.category);
    for (const alias of entry.aliases) {
      const key = alias.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: entry.canonical,
          aliasType: key === entry.canonical.toLowerCase() ? 'direct' : 'common_name',
          domain,
          riskLevel: entry.riskLevel,
          notes: null,
        });
      }
    }
  }

  for (const [allergenKey, def] of Object.entries(SCIENTIFIC_ALLERGEN_DATABASE)) {
    for (const name of def.scientificNames) {
      const key = name.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: allergenKey,
          aliasType: 'scientific_name',
          domain: 'food_allergen',
          riskLevel: def.severity,
          notes: null,
        });
      }
    }

    for (const name of def.commonNames) {
      const key = name.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: allergenKey,
          aliasType: 'common_name',
          domain: 'food_allergen',
          riskLevel: def.severity,
          notes: null,
        });
      }
    }

    for (const name of def.hiddenSources) {
      const key = name.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: allergenKey,
          aliasType: 'hidden_name',
          domain: 'food_allergen',
          riskLevel: def.severity,
          notes: `Hidden source of ${allergenKey}`,
        });
      }
    }

    for (const name of def.inci) {
      const key = name.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: allergenKey,
          aliasType: 'inci',
          domain: 'food_allergen',
          riskLevel: def.severity,
          notes: `INCI name for ${allergenKey}`,
        });
      }
    }

    for (const eNum of def.eNumber) {
      const key = eNum.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: allergenKey,
          aliasType: 'e_number',
          domain: 'food_allergen',
          riskLevel: def.severity,
          notes: `E-number for ${allergenKey}`,
        });
      }
    }
  }

  for (const trigger of ECZEMA_TRIGGERS) {
    for (const alias of trigger.aliases) {
      const key = alias.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: trigger.name.toLowerCase(),
          aliasType: 'eczema_alias',
          domain: 'eczema_trigger',
          riskLevel: trigger.severityHint,
          notes: trigger.notes ?? null,
        });
      }
    }
  }

  for (const trigger of FOOD_SENSITIVITY_TRIGGERS) {
    for (const keyword of trigger.keywords) {
      const key = keyword.toLowerCase().trim();
      if (!lookup.has(key)) {
        lookup.set(key, {
          canonical: trigger.id,
          aliasType: 'sensitivity_keyword',
          domain: 'food_sensitivity',
          riskLevel: null,
          notes: null,
        });
      }
    }
  }

  console.log(`[IngredientNormalizer] Lookup table built with ${lookup.size} entries`);
  aliasLookupCache = lookup;
  return lookup;
}

function categoryToDomain(
  category: CanonicalIngredient['category'],
): IngredientDomain {
  switch (category) {
    case 'allergen':
      return 'food_allergen';
    case 'additive':
      return 'additive';
    case 'preservative':
      return 'preservative';
    case 'emulsifier':
      return 'emulsifier';
    default:
      return 'unknown';
  }
}

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '');
}

function splitParenthetical(text: string): { main: string; sub: string[] } {
  const subIngredients: string[] = [];
  const parenRegex = /\(([^()]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = parenRegex.exec(text)) !== null) {
    const inner = match[1];
    if (inner) {
      const parts = inner.split(/[,;]/).map(p => p.trim()).filter(Boolean);
      subIngredients.push(...parts);
    }
  }

  const main = text.replace(/\([^()]*\)/g, '').trim();
  return { main, sub: subIngredients };
}

export function parseRawIngredientText(text: string): {
  ingredients: string[];
  warnings: string[];
} {
  if (!text || !text.trim()) {
    console.log('[IngredientNormalizer] Empty ingredient text provided');
    return { ingredients: [], warnings: ['Empty ingredient text'] };
  }

  const warnings: string[] = [];
  let cleaned = text
    .replace(/ingredients\s*:/i, '')
    .replace(/contains\s*:/i, '')
    .replace(/\*/g, '')
    .replace(/†/g, '')
    .replace(/®/g, '')
    .replace(/™/g, '')
    .replace(/©/g, '')
    .trim();

  if (cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  const bracketContent: string[] = [];
  const bracketRegex = /\[([^\]]*)\]/g;
  let bracketMatch: RegExpExecArray | null;
  while ((bracketMatch = bracketRegex.exec(cleaned)) !== null) {
    if (bracketMatch[1]) {
      bracketContent.push(bracketMatch[1]);
    }
  }
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

  const rawParts = cleaned.split(/[,;]/).map(p => p.trim()).filter(Boolean);

  const allIngredients: string[] = [];

  for (const part of rawParts) {
    const { main, sub } = splitParenthetical(part);
    if (main.trim()) {
      allIngredients.push(main.trim());
    }
    for (const s of sub) {
      if (s.trim()) {
        allIngredients.push(s.trim());
      }
    }
  }

  for (const content of bracketContent) {
    const parts = content.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    allIngredients.push(...parts);
  }

  const mayContainIdx = allIngredients.findIndex(
    i => /^may contain/i.test(i) || /^produced in/i.test(i) || /^manufactured in/i.test(i),
  );
  if (mayContainIdx !== -1) {
    warnings.push('Advisory warnings detected in ingredient text');
  }

  const uniqueIngredients = Array.from(
    new Set(allIngredients.map(i => cleanText(i)).filter(i => i.length > 0)),
  );

  if (uniqueIngredients.length === 0) {
    warnings.push('No parseable ingredients found');
  }

  console.log(`[IngredientNormalizer] Parsed ${uniqueIngredients.length} ingredients from raw text`);
  return { ingredients: uniqueIngredients, warnings };
}

export function normalizeIngredient(raw: string): NormalizedIngredient {
  const normalized = cleanText(raw);

  if (!normalized) {
    return {
      raw,
      normalized: '',
      canonical: null,
      matchStatus: 'unmatched',
      aliasType: 'none',
      matchConfidence: 'low',
      domain: 'unknown',
      riskLevel: null,
      notes: null,
    };
  }

  const lookup = buildAliasLookup();

  const exactMatch = lookup.get(normalized);
  if (exactMatch) {
    return {
      raw,
      normalized,
      canonical: exactMatch.canonical,
      matchStatus: 'matched',
      aliasType: exactMatch.aliasType,
      matchConfidence: 'high',
      domain: exactMatch.domain,
      riskLevel: exactMatch.riskLevel,
      notes: exactMatch.notes,
    };
  }

  for (const [alias, entry] of lookup) {
    if (alias.length < 3) continue;

    if (normalized.includes(alias) || alias.includes(normalized)) {
      const shorter = normalized.length < alias.length ? normalized : alias;
      const longer = normalized.length >= alias.length ? normalized : alias;
      const ratio = shorter.length / longer.length;

      if (ratio > 0.6) {
        return {
          raw,
          normalized,
          canonical: entry.canonical,
          matchStatus: 'partial',
          aliasType: entry.aliasType,
          matchConfidence: ratio > 0.85 ? 'medium' : 'low',
          domain: entry.domain,
          riskLevel: entry.riskLevel,
          notes: entry.notes,
        };
      }
    }
  }

  const words = normalized.split(/\s+/);
  if (words.length > 1) {
    for (const word of words) {
      if (word.length < 3) continue;
      const wordMatch = lookup.get(word);
      if (wordMatch) {
        return {
          raw,
          normalized,
          canonical: wordMatch.canonical,
          matchStatus: 'partial',
          aliasType: wordMatch.aliasType,
          matchConfidence: 'low',
          domain: wordMatch.domain,
          riskLevel: wordMatch.riskLevel,
          notes: `Partial word match on "${word}"`,
        };
      }
    }
  }

  return {
    raw,
    normalized,
    canonical: null,
    matchStatus: 'unmatched',
    aliasType: 'none',
    matchConfidence: 'low',
    domain: 'unknown',
    riskLevel: null,
    notes: null,
  };
}

export function normalizeIngredientList(rawText: string): ParsedIngredientList {
  console.log('[IngredientNormalizer] === Starting ingredient normalization ===');
  console.log(`[IngredientNormalizer] Input length: ${rawText.length} chars`);

  const { ingredients: rawIngredients, warnings } = parseRawIngredientText(rawText);
  const ingredients: NormalizedIngredient[] = rawIngredients.map(normalizeIngredient);

  const matchedCount = ingredients.filter(i => i.matchStatus === 'matched').length;
  const unmatchedCount = ingredients.filter(i => i.matchStatus === 'unmatched').length;
  const partialCount = ingredients.filter(i => i.matchStatus === 'partial').length;

  console.log(`[IngredientNormalizer] Results: ${matchedCount} matched, ${partialCount} partial, ${unmatchedCount} unmatched`);

  return {
    raw: rawText,
    ingredients,
    totalCount: ingredients.length,
    matchedCount,
    unmatchedCount,
    partialCount,
    parseWarnings: warnings,
  };
}

export function getCanonicalIngredients(parsed: ParsedIngredientList): string[] {
  const canonicals = new Set<string>();
  for (const ingredient of parsed.ingredients) {
    if (ingredient.canonical) {
      canonicals.add(ingredient.canonical);
    }
  }
  return Array.from(canonicals);
}

export function getIngredientsByDomain(
  parsed: ParsedIngredientList,
  domain: IngredientDomain,
): NormalizedIngredient[] {
  return parsed.ingredients.filter(i => i.domain === domain);
}

export function getMatchedAllergens(parsed: ParsedIngredientList): NormalizedIngredient[] {
  return parsed.ingredients.filter(
    i =>
      i.domain === 'food_allergen' &&
      (i.matchStatus === 'matched' || i.matchStatus === 'partial'),
  );
}

export function getMatchedEczemaTriggers(parsed: ParsedIngredientList): NormalizedIngredient[] {
  return parsed.ingredients.filter(
    i =>
      i.domain === 'eczema_trigger' &&
      (i.matchStatus === 'matched' || i.matchStatus === 'partial'),
  );
}

export function getMatchedSensitivities(parsed: ParsedIngredientList): NormalizedIngredient[] {
  return parsed.ingredients.filter(
    i =>
      i.domain === 'food_sensitivity' &&
      (i.matchStatus === 'matched' || i.matchStatus === 'partial'),
  );
}

export function getUnmatchedIngredients(parsed: ParsedIngredientList): NormalizedIngredient[] {
  return parsed.ingredients.filter(i => i.matchStatus === 'unmatched');
}

export function checkIngredientAgainstProfile(
  ingredient: NormalizedIngredient,
  profileAllergens: string[],
  profileEczemaGroups: string[],
): {
  isRelevant: boolean;
  reason: string | null;
  severity: 'critical' | 'high' | 'moderate' | 'low' | null;
} {
  if (!ingredient.canonical) {
    return { isRelevant: false, reason: null, severity: null };
  }

  const normalizedCanonical = ingredient.canonical.toLowerCase();

  for (const allergen of profileAllergens) {
    const normalizedAllergen = allergen.toLowerCase();
    if (
      normalizedCanonical === normalizedAllergen ||
      normalizedCanonical.includes(normalizedAllergen) ||
      normalizedAllergen.includes(normalizedCanonical)
    ) {
      return {
        isRelevant: true,
        reason: `Matches profile allergen "${allergen}"`,
        severity: ingredient.riskLevel === 'critical' ? 'critical' : 'high',
      };
    }
  }

  if (ingredient.domain === 'eczema_trigger') {
    const trigger = ECZEMA_TRIGGERS.find(
      t => t.name.toLowerCase() === normalizedCanonical,
    );
    if (trigger && profileEczemaGroups.includes(trigger.triggerGroup)) {
      return {
        isRelevant: true,
        reason: `Eczema trigger in tracked group "${trigger.triggerGroup}"`,
        severity: trigger.severityHint === 'high' ? 'high' : 'moderate',
      };
    }
  }

  return { isRelevant: false, reason: null, severity: null };
}

export function clearNormalizerCache(): void {
  aliasLookupCache = null;
  console.log('[IngredientNormalizer] Cache cleared');
}
