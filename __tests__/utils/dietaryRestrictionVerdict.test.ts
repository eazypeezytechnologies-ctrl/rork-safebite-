import { calculateDietaryRestrictionVerdict } from '@/utils/dietaryRestrictionVerdict';
import { Product, Profile } from '@/types';

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'test-profile',
  name: 'Test User',
  allergens: [],
  customKeywords: [],
  hasAnaphylaxis: false,
  emergencyContacts: [],
  medications: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dietaryRestrictions: {},
  dietaryStrictness: {},
  ...overrides,
});

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  code: '123456789',
  product_name: 'Test Product',
  source: 'manual_entry',
  ...overrides,
});

describe('Dietary Restriction Verdict', () => {
  test('1) No Pork (Standard) + skin product with stearic acid => verify warning, not block', () => {
    const profile = makeProfile({
      dietaryRestrictions: { no_pork: true },
      dietaryStrictness: { no_pork: 'standard' },
    });
    const product = makeProduct({
      product_type: 'skin',
      ingredients_text: 'Water, Stearic Acid, Cetyl Alcohol, Dimethicone',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('verify');
    expect(result.matches.some(m => m.matchedKeyword.toLowerCase().includes('stearic acid'))).toBe(true);
    expect(result.matches.every(m => m.matchGroup !== 'block')).toBe(true);
  });

  test('2) No Pork (Standard) + skin product with porcine collagen => block/unsafe', () => {
    const profile = makeProfile({
      dietaryRestrictions: { no_pork: true },
      dietaryStrictness: { no_pork: 'standard' },
    });
    const product = makeProduct({
      product_type: 'skin',
      ingredients_text: 'Water, Porcine Collagen, Hyaluronic Acid, Glycerin',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('unsafe');
    expect(result.matches.some(m => m.matchGroup === 'block')).toBe(true);
  });

  test('3) Halal (Strict) + food product with gelatin => verify', () => {
    const profile = makeProfile({
      dietaryRestrictions: { halal: true },
      dietaryStrictness: { halal: 'strict' },
    });
    const product = makeProduct({
      product_type: 'food',
      ingredients_text: 'Sugar, Water, Gelatin, Citric Acid, Natural Flavors',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('unsafe');
    const gelatinMatch = result.matches.find(m => m.matchedKeyword.toLowerCase() === 'gelatin');
    expect(gelatinMatch).toBeDefined();
  });

  test('4) Returns clear when no restrictions enabled', () => {
    const profile = makeProfile({
      dietaryRestrictions: {},
      dietaryStrictness: {},
    });
    const product = makeProduct({
      ingredients_text: 'Pork, Lard, Bacon',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('clear');
    expect(result.matches.length).toBe(0);
  });

  test('5) Handles null/missing dietary columns gracefully', () => {
    const profile = makeProfile({
      dietaryRestrictions: undefined,
      dietaryStrictness: undefined,
    });
    const product = makeProduct({
      ingredients_text: 'Water, Sugar',
    });

    expect(() => {
      const result = calculateDietaryRestrictionVerdict(product, profile);
      expect(result.level).toBe('clear');
    }).not.toThrow();
  });

  test('Relaxed strictness only flags block matches, ignores verify', () => {
    const profile = makeProfile({
      dietaryRestrictions: { no_pork: true },
      dietaryStrictness: { no_pork: 'relaxed' },
    });
    const product = makeProduct({
      product_type: 'food',
      ingredients_text: 'Water, Glycerin, Stearic Acid, Citric Acid',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('clear');
  });

  test('Cosmetic pork detection finds porcine in skin product', () => {
    const profile = makeProfile({
      dietaryRestrictions: { halal: true },
      dietaryStrictness: { halal: 'standard' },
    });
    const product = makeProduct({
      product_type: 'hair',
      ingredients_text: 'Water, Porcine Keratin, Dimethicone, Fragrance',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('unsafe');
    expect(result.cosmeticPorkMatches.length).toBeGreaterThan(0);
  });

  test('Default strictness is standard when not specified', () => {
    const profile = makeProfile({
      dietaryRestrictions: { no_pork: true },
      dietaryStrictness: {},
    });
    const product = makeProduct({
      product_type: 'food',
      ingredients_text: 'Water, Glycerin, Citric Acid',
    });

    const result = calculateDietaryRestrictionVerdict(product, profile);
    expect(result.level).toBe('verify');
    expect(result.matches.some(m => m.strictness === 'standard')).toBe(true);
  });
});
