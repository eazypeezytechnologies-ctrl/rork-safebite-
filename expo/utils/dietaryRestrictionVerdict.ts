import { Product, Profile, ProductType } from '@/types';
import { DIETARY_RESTRICTIONS_MASTER } from '@/constants/dietaryRestrictions';
import { STRICTNESS_RULES, DEFAULT_STRICTNESS, type StrictnessLevel } from '@/constants/restrictionStrictness';
import { findCosmeticPorkMatches, type CosmeticPorkMatch } from '@/constants/cosmeticPorkPack';

export type DietaryVerdictLevel = 'clear' | 'verify' | 'unsafe';

export interface DietaryRestrictionMatch {
  restrictionId: string;
  restrictionLabel: string;
  strictness: StrictnessLevel;
  matchedKeyword: string;
  matchGroup: 'block' | 'verify' | 'strict_verify';
}

export interface DietaryRestrictionVerdict {
  level: DietaryVerdictLevel;
  matches: DietaryRestrictionMatch[];
  cosmeticPorkMatches: CosmeticPorkMatch[];
  hasData: boolean;
  summary: string;
}

const FOOD_RESTRICTION_KEYWORDS: Record<string, { block: string[]; verify: string[]; strict_verify: string[] }> = {
  no_pork: {
    block: [
      'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'pepperoni', 'salami', 'chorizo',
      'pork fat', 'pork extract', 'pork gelatin', 'pig', 'swine', 'lard', 'porcine',
      'sausage', 'bratwurst', 'hot dog',
    ],
    verify: [
      'gelatin', 'gelatine', 'glycerin', 'glycerine', 'glycerol',
      'stearic acid', 'stearate', 'collagen', 'elastin', 'keratin',
      'animal fat', 'animal-derived', 'tallow', 'tallowate',
      'enzymes', 'lipase', 'pepsin',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'lecithin', 'e471', 'e472',
      'mono and diglycerides', 'mono- and diglycerides', 'monoglycerides', 'diglycerides',
      'emulsifier', 'parfum', 'fragrance',
    ],
  },
  halal: {
    block: [
      'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'pepperoni', 'salami', 'chorizo',
      'pork fat', 'pork extract', 'pork gelatin', 'pig', 'swine', 'lard', 'porcine',
      'alcohol', 'ethanol', 'ethyl alcohol', 'wine', 'beer', 'rum', 'bourbon', 'whiskey',
      'vodka', 'brandy', 'liqueur', 'tequila', 'gin', 'sake', 'mirin', 'cooking wine',
      'carmine', 'cochineal', 'e120', 'shellac', 'e904',
      'l-cysteine', 'e920', 'rennet', 'animal rennet',
    ],
    verify: [
      'gelatin', 'gelatine', 'glycerin', 'glycerine', 'glycerol',
      'stearic acid', 'stearate', 'collagen', 'elastin', 'keratin',
      'animal fat', 'animal-derived', 'tallow', 'tallowate',
      'enzymes', 'lipase', 'pepsin', 'vanilla extract',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'lecithin', 'e471', 'e472',
      'mono and diglycerides', 'emulsifier', 'parfum', 'fragrance',
      'vinegar', 'soy sauce',
    ],
  },
  kosher: {
    block: [
      'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'pepperoni', 'salami', 'chorizo',
      'pig', 'swine', 'lard', 'porcine',
      'shellfish', 'shrimp', 'crab', 'lobster', 'clam', 'oyster', 'mussel', 'scallop',
      'squid', 'octopus', 'catfish', 'shark', 'swordfish', 'sturgeon',
      'gelatin', 'rennet', 'animal rennet', 'carmine', 'cochineal', 'e120',
    ],
    verify: [
      'glycerin', 'glycerine', 'glycerol', 'stearic acid', 'stearate',
      'collagen', 'enzymes', 'lipase', 'pepsin',
      'animal fat', 'animal-derived', 'tallow',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'lecithin', 'e471', 'e472',
      'mono and diglycerides', 'emulsifier', 'vinegar',
    ],
  },
  vegan: {
    block: [
      'milk', 'dairy', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'whey', 'casein',
      'lactose', 'egg', 'eggs', 'albumin', 'honey', 'beeswax', 'gelatin', 'gelatine',
      'collagen', 'lard', 'tallow', 'suet', 'shellac', 'carmine', 'cochineal', 'isinglass',
      'lanolin', 'rennet', 'ghee', 'buttermilk', 'sour cream', 'kefir',
      'bone char', 'bone meal', 'fish oil', 'fish sauce', 'anchovy', 'anchovies',
      'oyster sauce', 'shrimp paste', 'l-cysteine', 'pepsin',
      'meat', 'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose',
      'fish', 'salmon', 'tuna', 'cod', 'sardine', 'shrimp', 'prawn', 'crab', 'lobster',
      'porcine', 'pig', 'swine',
    ],
    verify: [
      'glycerin', 'glycerine', 'glycerol', 'stearic acid', 'stearate',
      'vitamin d3', 'cholecalciferol', 'retinol',
      'enzymes', 'lipase',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'lecithin', 'e471', 'e472',
      'mono and diglycerides', 'emulsifier', 'sugar', 'confectioner\'s glaze',
    ],
  },
  vegetarian: {
    block: [
      'meat', 'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose',
      'venison', 'bison', 'rabbit', 'game', 'bacon', 'ham', 'prosciutto', 'salami',
      'pepperoni', 'chorizo', 'lard', 'tallow', 'suet', 'gelatin', 'gelatine',
      'rennet', 'animal rennet', 'isinglass', 'bone char', 'bone meal',
      'fish', 'salmon', 'tuna', 'cod', 'sardine', 'anchovy', 'anchovies',
      'shrimp', 'prawn', 'crab', 'lobster', 'shellfish',
      'fish sauce', 'oyster sauce', 'shrimp paste', 'fish oil',
      'l-cysteine', 'pepsin', 'porcine', 'pig', 'swine',
    ],
    verify: [
      'glycerin', 'glycerine', 'glycerol', 'stearic acid', 'stearate',
      'animal fat', 'animal-derived', 'enzymes', 'lipase',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'lecithin', 'e471', 'e472',
      'mono and diglycerides', 'emulsifier',
    ],
  },
  pescatarian: {
    block: [
      'meat', 'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose',
      'venison', 'bison', 'rabbit', 'game', 'bacon', 'ham', 'prosciutto', 'salami',
      'pepperoni', 'chorizo', 'lard', 'porcine', 'pig', 'swine',
    ],
    verify: [
      'gelatin', 'gelatine', 'animal fat', 'tallow', 'suet',
      'glycerin', 'glycerine', 'glycerol',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'e471', 'e472',
    ],
  },
  dairy_free: {
    block: [
      'milk', 'dairy', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt',
      'whey', 'casein', 'caseinate', 'lactose', 'lactalbumin', 'lactoglobulin',
      'ghee', 'buttermilk', 'sour cream', 'kefir', 'curds', 'quark',
      'milk solids', 'milk powder', 'milk protein', 'milk fat',
      'whey protein', 'whey powder',
    ],
    verify: [
      'lactylate', 'lactyc', 'caramel color',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours',
    ],
  },
  egg_free: {
    block: [
      'egg', 'eggs', 'albumin', 'albumen', 'ovalbumin', 'ovomucin', 'ovomucoid',
      'ovovitellin', 'globulin', 'livetin', 'lysozyme', 'vitellin',
      'egg white', 'egg yolk', 'egg powder', 'dried egg', 'egg solids',
      'mayonnaise', 'meringue',
    ],
    verify: [
      'lecithin', 'surimi',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'emulsifier',
    ],
  },
  gluten_free: {
    block: [
      'wheat', 'wheat flour', 'whole wheat', 'wheat bran', 'wheat germ', 'wheat starch',
      'gluten', 'vital wheat gluten', 'seitan', 'bulgur', 'couscous',
      'durum', 'einkorn', 'emmer', 'farina', 'farro', 'kamut', 'semolina',
      'spelt', 'triticale', 'barley', 'rye', 'malt', 'malt extract',
      'malt flavoring', 'malt syrup', 'malt vinegar', 'brewers yeast',
    ],
    verify: [
      'oats', 'oat flour', 'oatmeal',
      'modified food starch', 'dextrin', 'maltodextrin',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'soy sauce',
    ],
  },
  soy_free: {
    block: [
      'soy', 'soya', 'soybean', 'soybeans', 'edamame', 'tofu', 'tempeh',
      'miso', 'natto', 'soy sauce', 'soy milk', 'soy protein', 'soy flour',
      'soy lecithin', 'soy oil', 'soybean oil',
      'textured vegetable protein', 'tvp', 'hydrolyzed soy protein',
    ],
    verify: [
      'lecithin', 'vegetable oil', 'vegetable protein',
      'hydrolyzed vegetable protein', 'hvp',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'vegetable broth', 'vegetable gum',
    ],
  },
  nut_free: {
    block: [
      'peanut', 'peanuts', 'tree nut', 'tree nuts', 'almond', 'almonds',
      'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans',
      'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia',
      'brazil nut', 'pine nut', 'pine nuts',
      'peanut butter', 'almond butter', 'cashew butter',
      'nut butter', 'nut paste', 'nut oil', 'nut flour', 'nut milk',
      'marzipan', 'praline', 'gianduja', 'nougat',
    ],
    verify: [
      'arachis', 'shea butter', 'shea oil', 'butyrospermum',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours',
    ],
  },
  shellfish_free: {
    block: [
      'shellfish', 'shrimp', 'prawn', 'prawns', 'crab', 'lobster',
      'crayfish', 'crawfish', 'clam', 'clams', 'mussel', 'mussels',
      'oyster', 'oysters', 'scallop', 'scallops', 'squid', 'calamari',
      'octopus', 'abalone',
      'shrimp paste', 'oyster sauce',
    ],
    verify: [
      'glucosamine', 'chitosan',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours', 'fish sauce',
    ],
  },
  sesame_free: {
    block: [
      'sesame', 'sesame seed', 'sesame seeds', 'tahini', 'tahina',
      'sesame oil', 'sesame paste', 'halvah', 'halva', 'gomashio', 'gomasio',
    ],
    verify: [
      'hummus', 'baba ganoush',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours',
    ],
  },
  alcohol_free: {
    block: [
      'alcohol', 'ethanol', 'ethyl alcohol', 'wine', 'beer', 'rum',
      'bourbon', 'whiskey', 'vodka', 'brandy', 'liqueur', 'tequila',
      'gin', 'sake', 'mirin', 'cooking wine',
    ],
    verify: [
      'vanilla extract', 'almond extract',
    ],
    strict_verify: [
      'natural flavors', 'natural flavours',
    ],
  },
  caffeine_free: {
    block: [
      'caffeine', 'coffee', 'espresso', 'guarana', 'yerba mate',
    ],
    verify: [
      'tea', 'green tea', 'black tea', 'matcha', 'cocoa', 'cacao', 'chocolate',
    ],
    strict_verify: [],
  },
  low_sodium: {
    block: [],
    verify: [
      'sodium', 'salt', 'msg', 'monosodium glutamate', 'soy sauce',
    ],
    strict_verify: [
      'baking soda', 'sodium bicarbonate',
    ],
  },
  low_sugar: {
    block: [],
    verify: [
      'sugar', 'sucrose', 'high fructose corn syrup', 'corn syrup',
      'agave', 'honey', 'maple syrup', 'molasses', 'cane sugar',
      'dextrose', 'maltose', 'glucose',
    ],
    strict_verify: [
      'fruit juice concentrate', 'evaporated cane juice',
    ],
  },
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s\-']/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchKeywordInText(keyword: string, normalizedText: string): boolean {
  const normalizedKeyword = keyword.toLowerCase();
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(normalizedText);
}

export function calculateDietaryRestrictionVerdict(
  product: Product,
  profile: Profile,
): DietaryRestrictionVerdict {
  const restrictions = profile.dietaryRestrictions || {};
  const strictnessMap = profile.dietaryStrictness || {};

  const enabledRestrictions = Object.entries(restrictions)
    .filter(([_, enabled]) => enabled)
    .map(([id]) => id);

  if (enabledRestrictions.length === 0) {
    return {
      level: 'clear',
      matches: [],
      cosmeticPorkMatches: [],
      hasData: true,
      summary: '',
    };
  }

  const hasIngredientData = !!(
    product.ingredients_text?.trim() ||
    product.allergens_tags?.length ||
    product.traces_tags?.length
  );

  if (!hasIngredientData) {
    return {
      level: 'clear',
      matches: [],
      cosmeticPorkMatches: [],
      hasData: false,
      summary: 'No ingredient data available to check dietary restrictions.',
    };
  }

  const normalizedIngredients = normalizeText(product.ingredients_text || '');
  const normalizedAllergens = (product.allergens_tags || []).map(t => normalizeText(t.replace(/^en:/, '')));
  const normalizedCategories = (product.categories_tags || []).map(t => normalizeText(t.replace(/^en:/, '')));
  const allText = [normalizedIngredients, ...normalizedAllergens, ...normalizedCategories].join(' ');

  const matches: DietaryRestrictionMatch[] = [];
  const foundKeys = new Set<string>();

  const productType: ProductType = product.product_type || 'food';
  const isCosmeticProduct = productType === 'skin' || productType === 'hair';

  let cosmeticPorkMatches: CosmeticPorkMatch[] = [];
  if (isCosmeticProduct) {
    const porkRelevantRestrictions = ['no_pork', 'halal', 'kosher', 'vegan'];
    const hasPorkRelevant = enabledRestrictions.some(r => porkRelevantRestrictions.includes(r));
    if (hasPorkRelevant) {
      cosmeticPorkMatches = findCosmeticPorkMatches(product.ingredients_text || '');

      for (const cosmMatch of cosmeticPorkMatches) {
        for (const restrictionId of enabledRestrictions) {
          if (!porkRelevantRestrictions.includes(restrictionId)) continue;

          const strictness = (strictnessMap[restrictionId] as StrictnessLevel) || DEFAULT_STRICTNESS;
          const allowedGroups = STRICTNESS_RULES[strictness].matchGroups;

          if (allowedGroups.includes(cosmMatch.group)) {
            const key = `${restrictionId}:cosmetic:${cosmMatch.keyword}`;
            if (!foundKeys.has(key)) {
              foundKeys.add(key);
              const def = DIETARY_RESTRICTIONS_MASTER.find(d => d.id === restrictionId);
              matches.push({
                restrictionId,
                restrictionLabel: def?.label || restrictionId,
                strictness,
                matchedKeyword: cosmMatch.keyword,
                matchGroup: cosmMatch.group,
              });
            }
          }
        }
      }
    }
  }

  for (const restrictionId of enabledRestrictions) {
    const keywords = FOOD_RESTRICTION_KEYWORDS[restrictionId];
    if (!keywords) continue;

    const strictness = (strictnessMap[restrictionId] as StrictnessLevel) || DEFAULT_STRICTNESS;
    const allowedGroups = STRICTNESS_RULES[strictness].matchGroups;

    for (const group of ['block', 'verify', 'strict_verify'] as const) {
      if (!allowedGroups.includes(group)) continue;

      for (const keyword of keywords[group]) {
        if (matchKeywordInText(keyword, allText)) {
          const key = `${restrictionId}:${group}:${keyword}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            const def = DIETARY_RESTRICTIONS_MASTER.find(d => d.id === restrictionId);
            matches.push({
              restrictionId,
              restrictionLabel: def?.label || restrictionId,
              strictness,
              matchedKeyword: keyword,
              matchGroup: group,
            });
          }
        }
      }
    }
  }

  const hasBlock = matches.some(m => m.matchGroup === 'block');
  const hasVerify = matches.some(m => m.matchGroup === 'verify' || m.matchGroup === 'strict_verify');

  let level: DietaryVerdictLevel = 'clear';
  if (hasBlock) {
    level = 'unsafe';
  } else if (hasVerify) {
    level = 'verify';
  }

  let summary = '';
  if (level === 'unsafe') {
    const blockMatches = matches.filter(m => m.matchGroup === 'block');
    const restrictionNames = [...new Set(blockMatches.map(m => m.restrictionLabel))];
    summary = `Conflicts with: ${restrictionNames.join(', ')}`;
  } else if (level === 'verify') {
    const verifyMatches = matches.filter(m => m.matchGroup === 'verify' || m.matchGroup === 'strict_verify');
    const keywords = [...new Set(verifyMatches.map(m => m.matchedKeyword))].slice(0, 3);
    summary = `Verify: ${keywords.join(', ')} — source not specified`;
  }

  console.log(`[DietaryRestrictionVerdict] Product: ${product.product_name}, Level: ${level}, Matches: ${matches.length}`);

  return {
    level,
    matches,
    cosmeticPorkMatches,
    hasData: hasIngredientData,
    summary,
  };
}
