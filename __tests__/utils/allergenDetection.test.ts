import { isIngredientAllergen, getAllergenDefinition } from '@/constants/scientificAllergenDatabase';
import { calculateVerdict } from '@/utils/verdict';
import { Product, Profile } from '@/types';

describe('Allergen Detection System', () => {
  describe('Shea Butter Detection (Tree Nut Allergy)', () => {
    const treeNutProfile: Profile = {
      id: 'test-profile',
      name: 'Test User',
      allergens: ['tree nuts'],
      customKeywords: [],
      hasAnaphylaxis: true,
      emergencyContacts: [],
      medications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    test('should detect "shea butter" in ingredients text', () => {
      const result = isIngredientAllergen('shea butter', 'tree nuts');
      expect(result).toBe(true);
    });

    test('should detect "Butyrospermum Parkii" (scientific name)', () => {
      const result = isIngredientAllergen('Butyrospermum Parkii', 'tree nuts');
      expect(result).toBe(true);
    });

    test('should detect "Vitellaria paradoxa" (alternative scientific name)', () => {
      const result = isIngredientAllergen('vitellaria paradoxa', 'tree nuts');
      expect(result).toBe(true);
    });

    test('should detect "karite butter" (alternative name)', () => {
      const result = isIngredientAllergen('karite butter', 'tree nuts');
      expect(result).toBe(true);
    });

    test('should detect shea butter in Cantù product ingredients', () => {
      const product: Product = {
        code: '123456789',
        product_name: 'Cantù Shea Butter Hair Moisturizer',
        brands: 'Cantù',
        ingredients_text: 'Water, Butyrospermum Parkii (Shea Butter), Glycerin, Fragrance',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(product, treeNutProfile);
      
      expect(verdict.level).toBe('danger');
      expect(verdict.matches.length).toBeGreaterThan(0);
      expect(verdict.matches.some(m => m.matchedText?.toLowerCase().includes('shea'))).toBe(true);
    });

    test('should detect shea in ingredient list variations', () => {
      const variations = [
        'shea butter',
        'shea oil',
        'sheabutter',
        'shea nut',
        'butyrospermum parkii butter',
        'vitellaria paradoxa butter',
        'karite',
      ];

      variations.forEach(variation => {
        const result = isIngredientAllergen(variation, 'tree nuts');
        expect(result).toBe(true);
      });
    });

    test('should flag Cantù product as dangerous', () => {
      const cantuProduct: Product = {
        code: '0817513016066',
        product_name: 'Cantù Moisturizing Curl Activator Cream',
        brands: 'Cantù Beauty',
        ingredients_text: 'Aqua (Water), Butyrospermum Parkii (Shea) Butter, Glycerin, Cetearyl Alcohol',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(cantuProduct, treeNutProfile);
      
      console.log('Cantù Verdict:', verdict);
      console.log('Matches:', verdict.matches);
      
      expect(verdict.level).toBe('danger');
      expect(verdict.message).toContain('tree nuts');
    });
  });

  describe('Tree Nut Database Completeness', () => {
    test('should have comprehensive tree nut allergen definition', () => {
      const definition = getAllergenDefinition('tree nuts');
      
      expect(definition).not.toBeNull();
      expect(definition?.commonNames.length).toBeGreaterThan(20);
      expect(definition?.hiddenSources.length).toBeGreaterThan(10);
      expect(definition?.scientificNames.length).toBeGreaterThan(5);
    });

    test('should include shea butter in tree nut hidden sources', () => {
      const definition = getAllergenDefinition('tree nuts');
      
      const sheaVariants = ['shea butter', 'butyrospermum parkii', 'vitellaria paradoxa'];
      
      sheaVariants.forEach(variant => {
        const found = definition?.hiddenSources.some(s => 
          s.toLowerCase().includes(variant.toLowerCase())
        ) || definition?.scientificNames.some(s =>
          s.toLowerCase().includes(variant.toLowerCase())
        );
        
        expect(found).toBe(true);
      });
    });
  });

  describe('Wheat Detection (Jell-O Example)', () => {
    const wheatProfile: Profile = {
      id: 'test-profile-wheat',
      name: 'Wheat Allergy User',
      allergens: ['wheat'],
      customKeywords: [],
      hasAnaphylaxis: false,
      emergencyContacts: [],
      medications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    test('should detect wheat in modified food starch', () => {
      const result = isIngredientAllergen('modified wheat starch', 'wheat');
      expect(result).toBe(true);
    });

    test('should detect wheat flour', () => {
      const result = isIngredientAllergen('wheat flour', 'wheat');
      expect(result).toBe(true);
    });

    test('should flag product with wheat correctly', () => {
      const productWithWheat: Product = {
        code: '999999999',
        product_name: 'Jell-O Pudding Mix',
        ingredients_text: 'Sugar, Modified Food Starch, Contains Less than 2% of Modified Wheat Starch',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(productWithWheat, wheatProfile);
      
      expect(verdict.level).toBe('danger');
      expect(verdict.matches.some(m => m.allergen === 'wheat')).toBe(true);
    });

    test('should NOT flag regular Jell-O without wheat', () => {
      const regularJello: Product = {
        code: '888888888',
        product_name: 'Jell-O Regular Gelatin',
        ingredients_text: 'Sugar, Gelatin, Adipic Acid, Sodium Citrate, Fumaric Acid',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(regularJello, wheatProfile);
      
      expect(verdict.level).toBe('safe');
      expect(verdict.matches.length).toBe(0);
    });
  });

  describe('Custom Keywords', () => {
    test('should detect custom keywords in ingredients', () => {
      const profileWithCustomKeyword: Profile = {
        id: 'test-profile-custom',
        name: 'Custom Keyword User',
        allergens: [],
        customKeywords: ['xanthan gum'],
        hasAnaphylaxis: false,
        emergencyContacts: [],
        medications: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const product: Product = {
        code: '777777777',
        product_name: 'Test Product',
        ingredients_text: 'Water, Xanthan Gum, Salt',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(product, profileWithCustomKeyword);
      
      expect(verdict.level).toBe('danger');
      expect(verdict.matches.some(m => m.source === 'custom_keyword')).toBe(true);
    });
  });

  describe('Missing Data Handling', () => {
    test('should handle products with no ingredient data', () => {
      const profile: Profile = {
        id: 'test-profile',
        name: 'Test User',
        allergens: ['milk'],
        customKeywords: [],
        hasAnaphylaxis: false,
        emergencyContacts: [],
        medications: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const productNoData: Product = {
        code: '666666666',
        product_name: 'Unknown Product',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(productNoData, profile);
      
      expect(verdict.missingData).toBe(true);
      expect(verdict.level).toBe('safe');
      expect(verdict.message).toContain('cannot verify');
    });
  });

  describe('Allergen Tags', () => {
    test('should detect allergens from allergens_tags', () => {
      const milkProfile: Profile = {
        id: 'test-profile-milk',
        name: 'Milk Allergy User',
        allergens: ['milk'],
        customKeywords: [],
        hasAnaphylaxis: false,
        emergencyContacts: [],
        medications: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const product: Product = {
        code: '555555555',
        product_name: 'Milk Chocolate',
        allergens_tags: ['en:milk', 'en:dairy'],
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(product, milkProfile);
      
      expect(verdict.level).toBe('danger');
      expect(verdict.matches.some(m => m.source === 'allergens_tags')).toBe(true);
    });
  });

  describe('Traces Detection', () => {
    test('should detect traces and mark as caution', () => {
      const peanutProfile: Profile = {
        id: 'test-profile-peanut',
        name: 'Peanut Allergy User',
        allergens: ['peanuts'],
        customKeywords: [],
        hasAnaphylaxis: true,
        emergencyContacts: [],
        medications: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const product: Product = {
        code: '444444444',
        product_name: 'Chocolate Bar',
        traces_tags: ['en:peanuts', 'en:tree-nuts'],
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(product, peanutProfile);
      
      expect(verdict.level).toBe('caution');
      expect(verdict.matches.some(m => m.source === 'traces_tags')).toBe(true);
    });
  });

  describe('Multiple Allergen Detection', () => {
    test('should detect multiple allergens in same product', () => {
      const multiAllergyProfile: Profile = {
        id: 'test-profile-multi',
        name: 'Multiple Allergy User',
        allergens: ['milk', 'eggs', 'wheat'],
        customKeywords: [],
        hasAnaphylaxis: false,
        emergencyContacts: [],
        medications: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const product: Product = {
        code: '333333333',
        product_name: 'Cake Mix',
        ingredients_text: 'Wheat Flour, Sugar, Eggs, Milk Powder, Baking Soda',
        source: 'openfoodfacts',
      };

      const verdict = calculateVerdict(product, multiAllergyProfile);
      
      expect(verdict.level).toBe('danger');
      expect(verdict.matches.length).toBeGreaterThanOrEqual(3);
      
      const allergenTypes = verdict.matches.map(m => m.allergen);
      expect(allergenTypes.some(a => a.includes('milk'))).toBe(true);
      expect(allergenTypes.some(a => a.includes('egg'))).toBe(true);
      expect(allergenTypes.some(a => a.includes('wheat'))).toBe(true);
    });
  });
});
