export interface RawProductData {
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
  [key: string]: any;
}

export interface DetectedAllergen {
  allergen: string;
  matched: string;
  confidence: number;
  category: string;
  source: 'ingredients' | 'allergens_field' | 'traces';
}

export interface NormalizedProduct {
  code: string;
  product_name: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  ingredients_text: string;
  ingredients_raw: string;
  ingredients_tokens: string[];
  allergens?: string;
  allergens_tags: string[];
  traces?: string;
  traces_tags: string[];
  categories?: string;
  categories_tags: string[];
  detected_allergens: DetectedAllergen[];
  source: string;
  source_url?: string;
  confidence: number;
}

export type ProductSource = 
  | 'openfoodfacts' 
  | 'openbeautyfacts' 
  | 'openproductsfacts' 
  | 'upcitemdb' 
  | 'datakick' 
  | 'usda'
  | 'barcodelookup'
  | 'manual';

const SOURCE_CONFIDENCE: Record<ProductSource, number> = {
  openfoodfacts: 0.95,
  openbeautyfacts: 0.90,
  openproductsfacts: 0.85,
  usda: 0.92,
  datakick: 0.80,
  upcitemdb: 0.70,
  barcodelookup: 0.75,
  manual: 0.60,
};

const SOURCE_URLS: Record<ProductSource, (code: string) => string> = {
  openfoodfacts: (code) => `https://world.openfoodfacts.org/product/${code}`,
  openbeautyfacts: (code) => `https://world.openbeautyfacts.org/product/${code}`,
  openproductsfacts: (code) => `https://world.openproductsfacts.org/product/${code}`,
  usda: (code) => `https://fdc.nal.usda.gov/fdc-app.html#/?query=${code}`,
  datakick: (code) => `https://www.datakick.org/items/${code}`,
  upcitemdb: (code) => `https://www.upcitemdb.com/upc/${code}`,
  barcodelookup: (code) => `https://www.barcodelookup.com/${code}`,
  manual: () => '',
};

const ALLERGEN_ALIASES: Record<string, { canonical: string; confidence: number; category: string }> = {
  'milk': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'dairy': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'casein': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'caseinate': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'whey': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'lactose': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'lactalbumin': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'cream': { canonical: 'Milk', confidence: 0.95, category: 'dairy' },
  'butter': { canonical: 'Milk', confidence: 0.95, category: 'dairy' },
  'cheese': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'yogurt': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'yoghurt': { canonical: 'Milk', confidence: 1.0, category: 'dairy' },
  'ghee': { canonical: 'Milk', confidence: 0.9, category: 'dairy' },
  
  'egg': { canonical: 'Egg', confidence: 1.0, category: 'egg' },
  'eggs': { canonical: 'Egg', confidence: 1.0, category: 'egg' },
  'albumin': { canonical: 'Egg', confidence: 1.0, category: 'egg' },
  'albumen': { canonical: 'Egg', confidence: 1.0, category: 'egg' },
  'mayonnaise': { canonical: 'Egg', confidence: 0.95, category: 'egg' },
  'meringue': { canonical: 'Egg', confidence: 1.0, category: 'egg' },
  'ovalbumin': { canonical: 'Egg', confidence: 1.0, category: 'egg' },
  
  'peanut': { canonical: 'Peanuts', confidence: 1.0, category: 'legume' },
  'peanuts': { canonical: 'Peanuts', confidence: 1.0, category: 'legume' },
  'groundnut': { canonical: 'Peanuts', confidence: 1.0, category: 'legume' },
  'arachis': { canonical: 'Peanuts', confidence: 1.0, category: 'legume' },
  
  'almond': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'almonds': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'walnut': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'walnuts': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'cashew': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'cashews': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'pecan': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'pecans': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'pistachio': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'hazelnut': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'hazelnuts': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'filbert': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'macadamia': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'brazil nut': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'pine nut': { canonical: 'Tree Nuts', confidence: 1.0, category: 'tree_nut' },
  'marzipan': { canonical: 'Tree Nuts', confidence: 0.95, category: 'tree_nut' },
  
  'soy': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'soya': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'soybean': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'soybeans': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'soy lecithin': { canonical: 'Soy', confidence: 0.85, category: 'legume' },
  'edamame': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'tofu': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'tempeh': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  'miso': { canonical: 'Soy', confidence: 1.0, category: 'legume' },
  
  'wheat': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'gluten': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'flour': { canonical: 'Wheat', confidence: 0.9, category: 'grain' },
  'semolina': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'durum': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'spelt': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'bulgur': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'couscous': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  'seitan': { canonical: 'Wheat', confidence: 1.0, category: 'grain' },
  
  'fish': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'anchovy': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'anchovies': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'salmon': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'tuna': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'cod': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'sardine': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  'fish sauce': { canonical: 'Fish', confidence: 1.0, category: 'seafood' },
  
  'shellfish': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'shrimp': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'prawn': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'prawns': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'crab': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'lobster': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'clam': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'clams': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'mussel': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'mussels': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'oyster': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'scallop': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'squid': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  'calamari': { canonical: 'Shellfish', confidence: 1.0, category: 'seafood' },
  
  'sesame': { canonical: 'Sesame', confidence: 1.0, category: 'seed' },
  'sesame seed': { canonical: 'Sesame', confidence: 1.0, category: 'seed' },
  'sesame oil': { canonical: 'Sesame', confidence: 1.0, category: 'seed' },
  'tahini': { canonical: 'Sesame', confidence: 1.0, category: 'seed' },
  'halvah': { canonical: 'Sesame', confidence: 0.95, category: 'seed' },
  
  'mustard': { canonical: 'Mustard', confidence: 1.0, category: 'spice' },
  'celery': { canonical: 'Celery', confidence: 1.0, category: 'vegetable' },
  'lupin': { canonical: 'Lupin', confidence: 1.0, category: 'legume' },
  'lupine': { canonical: 'Lupin', confidence: 1.0, category: 'legume' },
  
  'sulfite': { canonical: 'Sulfites', confidence: 1.0, category: 'additive' },
  'sulfites': { canonical: 'Sulfites', confidence: 1.0, category: 'additive' },
  'sulphite': { canonical: 'Sulfites', confidence: 1.0, category: 'additive' },
  'sulphites': { canonical: 'Sulfites', confidence: 1.0, category: 'additive' },
  'sulfur dioxide': { canonical: 'Sulfites', confidence: 1.0, category: 'additive' },
};

export function cleanIngredientsText(raw: string): string {
  if (!raw) return '';
  
  let cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*\)/g, (match) => match)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/_+/g, ' ')
    .replace(/\*+/g, '')
    .replace(/\d+(\.\d+)?%/g, '')
    .replace(/E\d{3,4}[a-z]?/gi, (match) => `additive:${match}`)
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  
  return cleaned;
}

export function tokenizeIngredients(ingredientsText: string): string[] {
  if (!ingredientsText) return [];

  const tokens: string[] = [];
  
  const normalized = ingredientsText
    .toLowerCase()
    .replace(/\([^)]*\)/g, (match) => {
      const inner = match.slice(1, -1);
      return `, ${inner}, `;
    });

  const parts = normalized.split(/[,;]+/);
  
  for (const part of parts) {
    const cleaned = part
      .replace(/contains:?\s*/i, '')
      .replace(/may contain:?\s*/i, '')
      .replace(/traces of:?\s*/i, '')
      .replace(/\band\b/gi, ',')
      .replace(/\bor\b/gi, ',')
      .trim();

    if (cleaned.length > 1) {
      const subTokens = cleaned.split(',').map(t => t.trim()).filter(t => t.length > 1);
      tokens.push(...subTokens);
    }
  }

  const uniqueTokens = [...new Set(tokens)];
  
  return uniqueTokens.filter(token => {
    if (token.length < 2) return false;
    if (/^\d+$/.test(token)) return false;
    if (/^additive:/.test(token)) return true;
    return true;
  });
}

export function detectAllergensInText(
  text: string, 
  source: 'ingredients' | 'allergens_field' | 'traces'
): DetectedAllergen[] {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  const detected: DetectedAllergen[] = [];
  const seenCanonical = new Set<string>();

  const sortedAliases = Object.entries(ALLERGEN_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, info] of sortedAliases) {
    if (seenCanonical.has(info.canonical)) continue;
    
    const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      detected.push({
        allergen: info.canonical,
        matched: alias,
        confidence: info.confidence,
        category: info.category,
        source,
      });
      seenCanonical.add(info.canonical);
    }
  }

  return detected;
}

export function normalizeProduct(
  rawData: RawProductData,
  source: ProductSource
): NormalizedProduct {
  console.log(`[Normalization] Normalizing product ${rawData.code} from ${source}`);
  
  const ingredientsRaw = rawData.ingredients_text || '';
  const ingredientsCleaned = cleanIngredientsText(ingredientsRaw);
  const ingredientsTokens = tokenizeIngredients(ingredientsCleaned);

  const detectedAllergens: DetectedAllergen[] = [];
  
  const ingredientAllergens = detectAllergensInText(ingredientsCleaned, 'ingredients');
  detectedAllergens.push(...ingredientAllergens);

  if (rawData.allergens) {
    const allergenFieldAllergens = detectAllergensInText(rawData.allergens, 'allergens_field');
    for (const allergen of allergenFieldAllergens) {
      if (!detectedAllergens.some(d => d.allergen === allergen.allergen)) {
        detectedAllergens.push(allergen);
      }
    }
  }

  if (rawData.traces) {
    const traceAllergens = detectAllergensInText(rawData.traces, 'traces');
    for (const allergen of traceAllergens) {
      if (!detectedAllergens.some(d => d.allergen === allergen.allergen)) {
        allergen.confidence *= 0.7;
        detectedAllergens.push(allergen);
      }
    }
  }

  const sourceConfidence = SOURCE_CONFIDENCE[source] || 0.5;
  const sourceUrl = SOURCE_URLS[source]?.(rawData.code) || '';

  const normalized: NormalizedProduct = {
    code: rawData.code,
    product_name: rawData.product_name || '',
    brands: rawData.brands,
    image_url: rawData.image_url,
    image_front_url: rawData.image_front_url,
    ingredients_text: ingredientsCleaned,
    ingredients_raw: ingredientsRaw,
    ingredients_tokens: ingredientsTokens,
    allergens: rawData.allergens,
    allergens_tags: normalizeAllergenTags(rawData.allergens_tags || []),
    traces: rawData.traces,
    traces_tags: normalizeAllergenTags(rawData.traces_tags || []),
    categories: rawData.categories,
    categories_tags: rawData.categories_tags || [],
    detected_allergens: detectedAllergens,
    source,
    source_url: sourceUrl,
    confidence: sourceConfidence,
  };

  console.log(`[Normalization] Detected ${detectedAllergens.length} allergens in product ${rawData.code}`);
  
  return normalized;
}

function normalizeAllergenTags(tags: string[]): string[] {
  return tags.map(tag => {
    let normalized = tag
      .replace(/^en:/, '')
      .replace(/-/g, ' ')
      .toLowerCase();
    
    const aliasInfo = ALLERGEN_ALIASES[normalized];
    if (aliasInfo) {
      return aliasInfo.canonical.toLowerCase();
    }
    
    return normalized;
  });
}

export function mergeProducts(
  existing: NormalizedProduct | null,
  incoming: NormalizedProduct
): NormalizedProduct {
  if (!existing) return incoming;

  if (incoming.confidence > existing.confidence) {
    console.log(`[Normalization] Replacing product ${existing.code} (${existing.source}) with ${incoming.source} (higher confidence)`);
    return {
      ...incoming,
      detected_allergens: mergeAllergens(existing.detected_allergens, incoming.detected_allergens),
    };
  }

  const merged: NormalizedProduct = {
    ...existing,
    product_name: incoming.product_name || existing.product_name,
    brands: incoming.brands || existing.brands,
    image_url: incoming.image_url || existing.image_url,
    image_front_url: incoming.image_front_url || existing.image_front_url,
    ingredients_text: incoming.ingredients_text || existing.ingredients_text,
    ingredients_raw: incoming.ingredients_raw || existing.ingredients_raw,
    ingredients_tokens: [
      ...new Set([...existing.ingredients_tokens, ...incoming.ingredients_tokens])
    ],
    detected_allergens: mergeAllergens(existing.detected_allergens, incoming.detected_allergens),
  };

  return merged;
}

function mergeAllergens(
  existing: DetectedAllergen[],
  incoming: DetectedAllergen[]
): DetectedAllergen[] {
  const merged = new Map<string, DetectedAllergen>();

  for (const allergen of existing) {
    const key = allergen.allergen;
    if (!merged.has(key) || merged.get(key)!.confidence < allergen.confidence) {
      merged.set(key, allergen);
    }
  }

  for (const allergen of incoming) {
    const key = allergen.allergen;
    if (!merged.has(key) || merged.get(key)!.confidence < allergen.confidence) {
      merged.set(key, allergen);
    }
  }

  return Array.from(merged.values());
}

export function getCanonicalAllergen(alias: string): { canonical: string; confidence: number } | null {
  const lower = alias.toLowerCase().trim();
  const info = ALLERGEN_ALIASES[lower];
  
  if (info) {
    return { canonical: info.canonical, confidence: info.confidence };
  }
  
  return null;
}

export function getAllCanonicalAllergens(): string[] {
  const canonicals = new Set<string>();
  for (const info of Object.values(ALLERGEN_ALIASES)) {
    canonicals.add(info.canonical);
  }
  return Array.from(canonicals).sort();
}
