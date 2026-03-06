import { Product, Profile } from '@/types';
import { DIETARY_RULES, COMMON_AVOID_INGREDIENTS } from '@/constants/restrictions';

export interface DietaryMatch {
  rule: string;
  ruleLabel: string;
  matchedIngredient: string;
  originalText?: string;
}

export interface DietaryCompatibilityResult {
  isCompatible: boolean;
  matches: DietaryMatch[];
  checkedRules: string[];
  checkedAvoidIngredients: string[];
  hasIngredientData: boolean;
}

const DIETARY_RULE_KEYWORDS: Record<string, string[]> = {
  halal: [
    'pork', 'lard', 'gelatin', 'bacon', 'ham', 'prosciutto', 'pancetta',
    'pepperoni', 'salami', 'chorizo', 'alcohol', 'wine', 'beer', 'rum',
    'ethanol', 'ethyl alcohol', 'liqueur', 'brandy', 'whiskey', 'vodka',
    'bourbon', 'tequila', 'gin', 'sake', 'mirin', 'cooking wine',
    'pork fat', 'pork extract', 'pork gelatin', 'pig', 'swine',
    'carmine', 'cochineal', 'e120', 'shellac', 'e904',
    'l-cysteine', 'e920', 'rennet', 'animal rennet',
  ],
  kosher: [
    'pork', 'lard', 'shellfish', 'shrimp', 'crab', 'lobster', 'clam',
    'oyster', 'mussel', 'scallop', 'squid', 'octopus', 'gelatin',
    'rennet', 'animal rennet', 'carmine', 'cochineal', 'e120',
    'catfish', 'shark', 'swordfish', 'sturgeon',
  ],
  vegan: [
    'milk', 'dairy', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt',
    'whey', 'casein', 'lactose', 'egg', 'eggs', 'albumin', 'honey',
    'beeswax', 'gelatin', 'collagen', 'lard', 'tallow', 'suet',
    'shellac', 'carmine', 'cochineal', 'isinglass', 'lanolin',
    'rennet', 'ghee', 'buttermilk', 'sour cream', 'kefir',
    'bone char', 'bone meal', 'fish oil', 'fish sauce', 'anchovy',
    'anchovies', 'oyster sauce', 'shrimp paste', 'l-cysteine',
    'pepsin', 'vitamin d3', 'cholecalciferol',
    'milk powder', 'milk solids', 'milk protein', 'milk fat',
    'egg white', 'egg yolk', 'whole egg', 'dried egg',
    'meat', 'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal',
    'duck', 'goose', 'venison', 'bison', 'rabbit',
    'fish', 'salmon', 'tuna', 'cod', 'sardine', 'mackerel',
    'shrimp', 'prawn', 'crab', 'lobster',
  ],
  vegetarian: [
    'meat', 'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal',
    'duck', 'goose', 'venison', 'bison', 'rabbit', 'game',
    'bacon', 'ham', 'prosciutto', 'salami', 'pepperoni', 'chorizo',
    'lard', 'tallow', 'suet', 'gelatin', 'rennet', 'animal rennet',
    'isinglass', 'bone char', 'bone meal',
    'fish', 'salmon', 'tuna', 'cod', 'sardine', 'anchovy', 'anchovies',
    'shrimp', 'prawn', 'crab', 'lobster', 'shellfish',
    'fish sauce', 'oyster sauce', 'shrimp paste', 'fish oil',
    'l-cysteine', 'pepsin',
  ],
  no_pork: [
    'pork', 'lard', 'bacon', 'ham', 'prosciutto', 'pancetta',
    'pepperoni', 'salami', 'chorizo', 'pork fat', 'pork extract',
    'pork gelatin', 'pig', 'swine', 'sausage',
  ],
};

const AVOID_INGREDIENT_KEYWORDS: Record<string, string[]> = {
  pork: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'pepperoni', 'salami', 'chorizo', 'pig', 'swine', 'lard'],
  gelatin: ['gelatin', 'gelatine', 'gel agent'],
  lard: ['lard', 'pork fat', 'rendered pork'],
  alcohol: ['alcohol', 'ethanol', 'ethyl alcohol', 'wine', 'beer', 'rum', 'bourbon', 'whiskey', 'vodka', 'brandy', 'liqueur', 'mirin', 'cooking wine', 'sake'],
  carmine: ['carmine', 'cochineal', 'e120', 'natural red 4'],
  rennet: ['rennet', 'animal rennet'],
  whey: ['whey', 'whey protein', 'whey powder', 'whey concentrate'],
  casein: ['casein', 'caseinate', 'sodium caseinate', 'calcium caseinate'],
  shellac: ['shellac', 'e904', 'confectioner\'s glaze'],
  bone_char: ['bone char', 'bone meal', 'bone phosphate'],
  tallow: ['tallow', 'animal fat', 'rendered fat'],
  isinglass: ['isinglass', 'fish bladder'],
  l_cysteine: ['l-cysteine', 'e920', 'cysteine'],
  glycerin: ['glycerin', 'glycerine', 'glycerol'],
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function checkDietaryCompatibility(
  product: Product,
  profile: Profile
): DietaryCompatibilityResult {
  const dietaryRules = profile.dietaryRules || [];
  const avoidIngredients = profile.avoidIngredients || [];

  const hasIngredientData = !!(
    product.ingredients_text?.trim() ||
    product.allergens_tags?.length ||
    product.traces_tags?.length
  );

  if (dietaryRules.length === 0 && avoidIngredients.length === 0) {
    return {
      isCompatible: true,
      matches: [],
      checkedRules: [],
      checkedAvoidIngredients: [],
      hasIngredientData,
    };
  }

  if (!hasIngredientData) {
    return {
      isCompatible: true,
      matches: [],
      checkedRules: dietaryRules,
      checkedAvoidIngredients: avoidIngredients,
      hasIngredientData: false,
    };
  }

  const normalizedIngredients = normalizeText(product.ingredients_text || '');
  const normalizedAllergens = (product.allergens_tags || []).map(t => normalizeText(t.replace(/^en:/, '')));
  const allText = [normalizedIngredients, ...normalizedAllergens].join(' ');

  const matches: DietaryMatch[] = [];
  const foundSet = new Set<string>();

  for (const ruleId of dietaryRules) {
    const keywords = DIETARY_RULE_KEYWORDS[ruleId] || [];
    const ruleInfo = DIETARY_RULES.find(r => r.id === ruleId);
    const ruleLabel = ruleInfo?.label || ruleId;

    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(allText)) {
        const matchKey = `${ruleId}:${keyword}`;
        if (!foundSet.has(matchKey)) {
          foundSet.add(matchKey);
          matches.push({
            rule: ruleId,
            ruleLabel,
            matchedIngredient: keyword,
          });
        }
        break;
      }
    }
  }

  for (const ingredientId of avoidIngredients) {
    const keywords = AVOID_INGREDIENT_KEYWORDS[ingredientId] || [ingredientId];
    const ingredientInfo = COMMON_AVOID_INGREDIENTS.find(i => i.id === ingredientId);
    const ingredientLabel = ingredientInfo?.label || ingredientId;

    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(allText)) {
        const matchKey = `avoid:${ingredientId}:${keyword}`;
        if (!foundSet.has(matchKey)) {
          foundSet.add(matchKey);
          matches.push({
            rule: `avoid_${ingredientId}`,
            ruleLabel: `Avoid: ${ingredientLabel}`,
            matchedIngredient: keyword,
          });
        }
        break;
      }
    }
  }

  return {
    isCompatible: matches.length === 0,
    matches,
    checkedRules: dietaryRules,
    checkedAvoidIngredients: avoidIngredients,
    hasIngredientData,
  };
}

export function getDietaryRuleLabel(ruleId: string): string {
  const rule = DIETARY_RULES.find(r => r.id === ruleId);
  return rule?.label || ruleId;
}

export function getAvoidIngredientLabel(ingredientId: string): string {
  const ingredient = COMMON_AVOID_INGREDIENTS.find(i => i.id === ingredientId);
  return ingredient?.label || ingredientId;
}
