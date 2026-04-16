import { ProductType } from '@/types';
import { getUserCategoryOverride } from '@/storage/productCache';

const SKIN_SIGNALS = [
  'aqua', 'parfum', 'dimethicone', 'cetyl alcohol', 'stearyl alcohol',
  'glycerin', 'tocopherol', 'retinol', 'hyaluronic', 'niacinamide',
  'salicylic', 'benzoyl', 'petroleum', 'mineral oil', 'lanolin',
  'shea butter', 'cocoa butter', 'aloe vera', 'jojoba', 'argan',
  'sunscreen', 'spf', 'moisturizer', 'lotion', 'cream', 'serum',
  'cleanser', 'toner', 'exfoliant', 'derma', 'skin care',
  'body wash', 'soap', 'face wash', 'deodorant', 'antiperspirant',
];

const HAIR_SIGNALS = [
  'shampoo', 'conditioner', 'hair', 'scalp', 'keratin',
  'biotin', 'panthenol', 'sodium lauryl sulfate', 'sodium laureth sulfate',
  'cocamidopropyl betaine', 'hair gel', 'hair spray', 'mousse',
  'curl', 'frizz', 'detangle', 'leave-in', 'deep condition',
  'hair oil', 'hair mask', 'hair color', 'dye', 'bleach',
];

const FOOD_SIGNALS = [
  'calories', 'protein', 'carbohydrate', 'fat', 'sugar', 'fiber',
  'sodium', 'cholesterol', 'vitamin', 'mineral', 'nutrition facts',
  'serving size', 'daily value', 'enriched flour', 'corn syrup',
  'high fructose', 'natural flavor', 'artificial flavor',
  'preservative', 'food', 'snack', 'cereal', 'bread', 'milk',
  'cheese', 'yogurt', 'juice', 'beverage', 'organic',
  'gluten', 'wheat', 'soy', 'peanut', 'tree nut',
];

export function guessProductType(
  ingredients?: string,
  productName?: string,
  categories?: string
): ProductType {
  const text = [ingredients, productName, categories]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!text) return 'other';

  let hairScore = 0;
  let skinScore = 0;
  let foodScore = 0;

  for (const signal of HAIR_SIGNALS) {
    if (text.includes(signal)) hairScore++;
  }
  for (const signal of SKIN_SIGNALS) {
    if (text.includes(signal)) skinScore++;
  }
  for (const signal of FOOD_SIGNALS) {
    if (text.includes(signal)) foodScore++;
  }

  if (hairScore > skinScore && hairScore > foodScore && hairScore >= 2) return 'hair';
  if (skinScore > foodScore && skinScore >= 2) return 'skin';
  if (foodScore >= 1) return 'food';
  if (skinScore >= 1) return 'skin';

  return 'food';
}

export function getProductTypeLabel(type?: ProductType): string {
  switch (type) {
    case 'food': return 'Food';
    case 'skin': return 'Skin';
    case 'hair': return 'Hair';
    case 'other': return 'Other';
    default: return 'Food';
  }
}

export function getProductTypeColor(type?: ProductType): string {
  switch (type) {
    case 'food': return '#10B981';
    case 'skin': return '#8B5CF6';
    case 'hair': return '#EC4899';
    case 'other': return '#6B7280';
    default: return '#10B981';
  }
}

export function getProductTypeEmoji(type?: ProductType): string {
  switch (type) {
    case 'food': return '🍽';
    case 'skin': return '🧴';
    case 'hair': return '💇';
    case 'other': return '📦';
    default: return '🍽';
  }
}

export async function getProductTypeWithOverride(
  barcode: string,
  ingredients?: string,
  productName?: string,
  categories?: string,
  existingType?: ProductType,
): Promise<ProductType> {
  const override = await getUserCategoryOverride(barcode);
  if (override) {
    console.log('[ProductType] Using user override for', barcode, '->', override);
    return override;
  }
  return existingType || guessProductType(ingredients, productName, categories);
}
