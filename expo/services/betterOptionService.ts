import { Product, Profile, ProductType, Verdict } from '@/types';
import { generateText } from '@rork-ai/toolkit-sdk';
import { getUserCategoryOverride } from '@/storage/productCache';
import { guessProductType, getCategoryGroup } from '@/utils/productType';

export interface BetterOption {
  productName: string;
  brand: string;
  reason: string;
  whereToFind: string;
  features: string[];
}

export interface BetterOptionResult {
  options: BetterOption[];
  headline: string;
  categoryGroup: 'food' | 'personal_care' | 'household' | 'other';
  productType: ProductType;
}

function buildProfileContext(profile: Profile): string {
  const parts: string[] = [];
  if (profile.allergens.length > 0) parts.push(`Allergies: ${profile.allergens.join(', ')}`);
  if (profile.customKeywords.length > 0) parts.push(`Custom avoid keywords: ${profile.customKeywords.join(', ')}`);
  if (profile.avoidIngredients?.length) parts.push(`Avoid ingredients: ${profile.avoidIngredients.join(', ')}`);
  if (profile.eczemaTriggerGroups?.length) parts.push(`Skin/eczema triggers: ${profile.eczemaTriggerGroups.join(', ')}`);
  if (profile.dietaryRules?.length) parts.push(`Dietary rules: ${profile.dietaryRules.join(', ')}`);
  const activeRestrictions = Object.entries(profile.dietaryRestrictions || {})
    .filter(([, v]) => v).map(([k]) => k);
  if (activeRestrictions.length > 0) parts.push(`Dietary restrictions: ${activeRestrictions.join(', ')}`);
  if (profile.hasAnaphylaxis) parts.push('Anaphylaxis risk: YES — zero tolerance for cross-contamination.');
  return parts.join('\n');
}

function categoryGuidance(productType: ProductType): { label: string; rule: string; stores: string } {
  switch (productType) {
    case 'food':
      return {
        label: 'FOOD / DRINK / SUPPLEMENT',
        rule: 'Recommend ONLY edible products (food, drink, supplement). Never recommend skincare, hair, or household products.',
        stores: 'Walmart, Target, Whole Foods, Sprouts, Amazon, Thrive Market',
      };
    case 'skin':
      return {
        label: 'SKIN / BODY PRODUCT',
        rule: 'Recommend ONLY skin or body-care products (cleanser, lotion, cream, sunscreen, etc). Never recommend food or household products.',
        stores: 'Sephora, Ulta, Target Beauty, CVS, Walgreens, dermatologist-recommended brands',
      };
    case 'hair':
      return {
        label: 'HAIR PRODUCT',
        rule: 'Recommend ONLY hair-care products (shampoo, conditioner, styling). Never recommend food or household products.',
        stores: 'Sephora, Ulta, Target, CVS, Walgreens, Sally Beauty',
      };
    case 'household':
      return {
        label: 'HOUSEHOLD PRODUCT',
        rule: 'Recommend ONLY household products (cleaners, detergents, disinfectants). Never recommend food, skincare or personal care.',
        stores: 'Target, Walmart, Whole Foods, Grove Collaborative, Amazon',
      };
    default:
      return {
        label: 'GENERAL PRODUCT',
        rule: 'Match the product type exactly. Do not cross categories.',
        stores: 'Major retailers',
      };
  }
}

function extractJsonArray(text: string): any[] | null {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function generateBetterOptions(
  product: Product,
  profile: Profile,
  verdict: Verdict | null,
): Promise<BetterOptionResult> {
  const override = await getUserCategoryOverride(product.code).catch(() => null);
  const productType: ProductType = override
    || product.product_type
    || guessProductType(product.ingredients_text, product.product_name, product.categories);
  const categoryGroup = getCategoryGroup(productType);
  const guidance = categoryGuidance(productType);

  const issueContext = verdict && verdict.matches.length > 0
    ? `Detected concerns: ${verdict.matches.map(m => m.allergen).join(', ')}`
    : verdict?.missingData
      ? 'Concern: ingredient data is missing — need transparent alternatives.'
      : 'Concern: user wants a better option based on their profile.';

  const prompt = `You recommend safer product alternatives for SafeBite users. Respond ONLY with a valid JSON array of 4 objects, no prose.

Product being replaced:
- Name: ${product.product_name || 'Unknown'}
- Brand: ${product.brands || 'Unknown'}
- Category: ${guidance.label}
- Barcode: ${product.code}

${issueContext}

User profile:
${buildProfileContext(profile)}

Category rule: ${guidance.rule}

Respond with JSON array of exactly 4 items, each: {"brand":"","productName":"","reason":"","whereToFind":"","features":["",""]}
- "reason": one short sentence explaining why this is safe for THIS user's profile (reference their actual restrictions).
- "features": 2-3 short tags (e.g. "peanut-free", "fragrance-free", "vegan").
- "whereToFind": stores like ${guidance.stores}.
Only real, widely-available products. No disclaimers, no markdown, no commentary — JSON array only.`;

  const raw = await generateText({ messages: [{ role: 'user', content: prompt }] });
  const arr = extractJsonArray(raw);

  const options: BetterOption[] = Array.isArray(arr)
    ? arr.slice(0, 6).map((o: any) => ({
        brand: String(o.brand || '').trim(),
        productName: String(o.productName || o.name || '').trim(),
        reason: String(o.reason || '').trim(),
        whereToFind: String(o.whereToFind || '').trim(),
        features: Array.isArray(o.features) ? o.features.map((f: any) => String(f)).slice(0, 4) : [],
      })).filter(o => o.brand && o.productName)
    : [];

  const headline = verdict?.level === 'danger'
    ? `Better options for ${profile.name}`
    : verdict?.missingData
      ? `Transparent alternatives for ${profile.name}`
      : `Safer picks for ${profile.name}`;

  return { options, headline, categoryGroup, productType };
}
