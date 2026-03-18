import { Product, Profile, Verdict, AllergenMatch, VerdictLevel, EczemaTriggerMatch } from '@/types';
import { calculateEnhancedVerdict, EnhancedVerdict, getConfidenceColor, getConfidenceLabel } from './advancedAllergenDetection';
import { getAllSynonymsForAllergen } from '@/constants/scientificAllergenDatabase';
import { findEczemaTriggerMatches } from '@/constants/eczemaTriggers';
import { findFoodSensitivityMatches } from '@/constants/sensitivityTriggers';

export type { EnhancedVerdict };
export { getConfidenceColor, getConfidenceLabel };

const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  'milk': [
    'milk', 'dairy', 'casein', 'caseinate', 'whey', 'lactose', 'lactalbumin', 'lactoglobulin',
    'butter', 'buttermilk', 'cream', 'cheese', 'yogurt', 'yoghurt', 'ghee', 'curds',
    'custard', 'pudding', 'half-and-half', 'sour cream', 'kefir', 'quark',
    'recaldent', 'simplesse', 'rennet', 'tagatose', 'nougat', 'caramel',
    'sodium caseinate', 'calcium caseinate', 'potassium caseinate', 'magnesium caseinate',
    'lactyc esters', 'lactylate', 'milk solids', 'milk powder', 'milk protein',
    'milk fat', 'milk derivative', 'whey protein', 'whey powder', 'whey concentrate',
    'hydrolyzed milk protein', 'hydrolysed milk protein'
  ],
  'eggs': [
    'egg', 'eggs', 'albumin', 'albumen', 'ovalbumin', 'ovomucin', 'ovomucoid',
    'ovovitellin', 'globulin', 'livetin', 'lysozyme', 'vitellin',
    'egg white', 'egg yolk', 'egg powder', 'dried egg', 'egg solids',
    'egg substitute', 'eggnog', 'mayonnaise', 'meringue', 'surimi',
    'simplesse', 'apovitellin', 'cholesterol free egg substitute',
    'egg protein', 'egg lecithin', 'whole egg', 'powdered eggs'
  ],
  'fish': [
    'fish', 'anchovy', 'anchovies', 'bass', 'catfish', 'cod', 'flounder', 'grouper',
    'haddock', 'hake', 'halibut', 'herring', 'mahi mahi', 'perch', 'pike', 'pollock',
    'salmon', 'sardine', 'sardines', 'sole', 'snapper', 'swordfish', 'tilapia',
    'trout', 'tuna', 'fish sauce', 'fish oil', 'fish stock', 'fish gelatin',
    'worcestershire sauce', 'caesar dressing', 'imitation crab', 'surimi',
    'bouillabaisse', 'fish protein', 'fish extract', 'dha from fish', 'omega-3 from fish'
  ],
  'shellfish': [
    'shellfish', 'crustacean', 'crustaceans', 'shrimp', 'prawn', 'prawns', 'crab',
    'lobster', 'crayfish', 'crawfish', 'langoustine', 'krill', 'barnacle',
    'mollusc', 'mollusk', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters',
    'scallop', 'scallops', 'snail', 'snails', 'escargot', 'squid', 'calamari',
    'octopus', 'cuttlefish', 'abalone', 'cockle', 'periwinkle', 'whelk',
    'glucosamine', 'chitosan', 'shellfish extract', 'shellfish flavoring',
    'crab extract', 'lobster extract', 'shrimp paste', 'fish sauce'
  ],
  'tree nuts': [
    'tree nut', 'tree nuts', 'almond', 'almonds', 'brazil nut', 'brazil nuts',
    'cashew', 'cashews', 'chestnut', 'chestnuts', 'hazelnut', 'hazelnuts', 'filbert',
    'hickory nut', 'macadamia', 'macadamia nut', 'pecan', 'pecans', 'pine nut',
    'pine nuts', 'pignoli', 'pignolia', 'pistachio', 'pistachios', 'walnut', 'walnuts',
    'beechnut', 'butternut', 'chinquapin', 'ginkgo nut', 'shea nut', 'shea nuts',
    'shea butter', 'shea oil', 'sheabutter', 'sheanut', 'shea', 'sheaoil',
    'butyrospermum parkii', 'butyrospermum parkii butter', 'butyrospermum parkii oil',
    'butyrospermum', 'vitellaria paradoxa', 'vitellaria paradoxa butter', 'vitellaria paradoxa oil',
    'vitellaria', 'karite butter', 'karite oil', 'karite', 'coconut',
    'nut butter', 'nut paste', 'nut oil', 'nut flour', 'nut milk', 'marzipan',
    'nougat', 'praline', 'gianduja', 'frangelico', 'amaretto', 'natural nut extract',
    'artificial nut flavoring', 'nu-nuts', 'nut meat', 'nut pieces',
    'almond butter', 'almond oil', 'cashew butter', 'cashew cream',
    'hazelnut butter', 'hazelnut oil', 'walnut oil', 'macadamia butter',
    'pistachio butter', 'pecan butter'
  ],
  'peanuts': [
    'peanut', 'peanuts', 'groundnut', 'ground nut', 'goober', 'monkey nut',
    'peanut butter', 'peanut oil', 'peanut flour', 'peanut protein', 'arachis oil',
    'arachis hypogaea', 'beer nuts', 'mandelonas', 'nu-nuts', 'mixed nuts',
    'peanut paste', 'peanut sauce', 'satay', 'goobers', 'hydrolyzed peanut protein',
    'cold pressed peanut oil', 'expelled peanut oil', 'extruded peanut',
    'ground nuts', 'arachis', 'valencias', 'spanish peanuts'
  ],
  'wheat': [
    'wheat', 'wheat flour', 'whole wheat', 'white wheat', 'bread flour',
    'all-purpose flour', 'wheat bran', 'wheat germ', 'wheat starch', 'wheat protein',
    'vital wheat gluten', 'seitan', 'bulgur', 'couscous', 'cracker meal',
    'durum', 'einkorn', 'emmer', 'farina', 'farro', 'fu', 'graham flour', 'kamut',
    'matzoh', 'matzo', 'semolina', 'spelt', 'triticale', 'wheat berries',
    'wheat grass', 'hydrolyzed wheat protein', 'wheat germ oil', 'wheat maltodextrin',
    'modified wheat starch', 'wheat dextrin', 'enriched flour', 'bromated flour',
    'enriched wheat flour', 'bleached flour', 'unbleached flour', 'plain flour',
    'self-rising flour', 'self raising flour', 'cake flour', 'pastry flour'
  ],
  'gluten': [
    'gluten', 'wheat', 'barley', 'rye', 'malt', 'malt extract', 'malt flavoring',
    'malt syrup', 'malt vinegar', 'malted milk', 'brewers yeast', 'wheat starch',
    'wheat protein', 'hydrolyzed wheat protein', 'triticale', 'spelt', 'kamut',
    'farro', 'bulgur', 'couscous', 'seitan', 'durum', 'semolina', 'farina',
    'graham flour', 'matzo', 'matzoh', 'beer', 'ale', 'lager'
  ],
  'soybeans': [
    'soy', 'soya', 'soybean', 'soybeans', 'soy bean', 'edamame', 'tofu', 'tempeh',
    'miso', 'natto', 'shoyu', 'tamari', 'soy sauce', 'soy milk', 'soy protein',
    'soy flour', 'soy lecithin', 'soy oil', 'soybean oil',
    'textured soy protein', 'tvp', 'hydrolyzed soy protein', 'soy protein isolate',
    'soy protein concentrate', 'soy albumin', 'soy fiber', 'soy grits', 'soy nuts',
    'soy sprouts', 'soy yogurt', 'yuba', 'kinako', 'okara', 'glycine max',
    'teriyaki'
  ],
  'sesame': [
    'sesame', 'sesame seed', 'sesame seeds', 'tahini', 'tahina', 'sesame oil',
    'sesame paste', 'sesamol', 'sesamolina', 'benne', 'benne seed', 'benniseed',
    'gingelly', 'gingelly oil', 'til', 'simsim', 'sesame flour', 'sesame salt',
    'gomasio', 'gomashio', 'halvah', 'halva', 'hummus', 'baba ganoush',
    'sesame butter', 'sesamum indicum'
  ],
  'mustard': [
    'mustard', 'mustard seed', 'mustard seeds', 'mustard powder', 'mustard flour',
    'mustard oil', 'mustard greens', 'mustard sauce', 'dijon mustard', 'yellow mustard',
    'brown mustard', 'black mustard', 'white mustard', 'oriental mustard',
    'indian mustard', 'mustard bran', 'brassica', 'sinapis alba'
  ],
  'celery': [
    'celery', 'celery seed', 'celery seeds', 'celery salt', 'celery root', 'celeriac',
    'celery stalk', 'celery leaves', 'celery powder', 'celery extract', 'celery oil',
    'celery flavoring', 'apium graveolens', 'celery juice'
  ],
  'lupin': [
    'lupin', 'lupine', 'lupini', 'lupin bean', 'lupin beans', 'lupin flour',
    'lupin protein', 'lupin seed', 'lupin seeds', 'lupinus', 'lupinus albus',
    'lupin fiber', 'lupin fibre'
  ],
  'sulfites': [
    'sulfite', 'sulfites', 'sulphite', 'sulphites', 'sulfur dioxide', 'sulphur dioxide',
    'sodium sulfite', 'sodium bisulfite', 'sodium metabisulfite', 'potassium bisulfite',
    'potassium metabisulfite', 'calcium sulfite', 'calcium bisulfite',
    'e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228',
    'sulfiting agent', 'sulphiting agent'
  ],
};

function normalizeAllergen(allergen: string): string {
  return allergen.toLowerCase().trim();
}

function getAllergenSynonyms(allergen: string): string[] {
  const normalized = normalizeAllergen(allergen);
  
  const scientificSynonyms = getAllSynonymsForAllergen(allergen);
  if (scientificSynonyms.length > 1) {
    return scientificSynonyms;
  }
  
  for (const [key, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return synonyms;
    }
  }
  
  return [normalized];
}

function checkAllergenTags(
  tags: string[] | undefined,
  profileAllergens: string[],
  source: 'allergens_tags' | 'traces_tags'
): AllergenMatch[] {
  if (!tags || tags.length === 0) return [];
  
  const matches: AllergenMatch[] = [];
  const normalizedProfile = profileAllergens.map(normalizeAllergen);
  
  for (const tag of tags) {
    const normalizedTag = normalizeAllergen(tag.replace(/^en:/, ''));
    
    for (const profileAllergen of normalizedProfile) {
      if (normalizedTag.includes(profileAllergen) || profileAllergen.includes(normalizedTag)) {
        matches.push({
          allergen: profileAllergen,
          source,
          matchedText: tag,
        });
      }
    }
  }
  
  return matches;
}

const FLOUR_SAFE_PREFIXES = [
  'rice', 'coconut', 'almond', 'oat', 'corn', 'tapioca', 'potato', 'chickpea',
  'cassava', 'buckwheat', 'millet', 'sorghum', 'teff', 'amaranth', 'quinoa',
  'arrowroot', 'bean', 'lentil', 'pea', 'garbanzo', 'plantain', 'banana',
  'hazelnut', 'chestnut', 'acorn', 'mesquite', 'tigernut', 'hemp', 'flax',
  'sunflower', 'pumpkin seed', 'sweet potato', 'yam', 'water chestnut',
];

function isContextualFalsePositive(
  normalizedText: string,
  synonym: string,
  allergen: string
): boolean {
  const lowerSynonym = synonym.toLowerCase();
  const lowerAllergen = allergen.toLowerCase();

  const flourSynonyms = [
    'flour', 'enriched flour', 'bleached flour', 'unbleached flour', 'plain flour',
    'all-purpose flour', 'bread flour', 'cake flour', 'pastry flour',
    'self-rising flour', 'self raising flour',
  ];

  if (
    (lowerAllergen === 'wheat' || lowerAllergen === 'gluten') &&
    flourSynonyms.includes(lowerSynonym)
  ) {
    const hasWheatFlour = /\bwheat\s+flour\b/i.test(normalizedText);
    if (hasWheatFlour) {
      return false;
    }

    let hasNonWheatFlour = false;
    for (const prefix of FLOUR_SAFE_PREFIXES) {
      const safePattern = new RegExp('\\b' + prefix + '\\s+flour\\b', 'i');
      if (safePattern.test(normalizedText)) {
        hasNonWheatFlour = true;
        break;
      }
    }

    if (hasNonWheatFlour) {
      const standaloneFlourPattern = /(?:^|[,;.()\s])flour(?:[,;.()\s]|$)/i;
      if (!standaloneFlourPattern.test(normalizedText)) {
        console.log('   \u23ed\ufe0f FALSE POSITIVE SKIPPED: "' + synonym + '" is a non-wheat flour type');
        return true;
      }
    }
  }

  if (lowerAllergen === 'eggs' && lowerSynonym === 'lecithin') {
    const hasSoyLecithin = /\bsoy\s+lecithin\b/i.test(normalizedText);
    const hasSunflowerLecithin = /\bsunflower\s+lecithin\b/i.test(normalizedText);
    const hasEggLecithin = /\begg\s+lecithin\b/i.test(normalizedText);
    if ((hasSoyLecithin || hasSunflowerLecithin) && !hasEggLecithin) {
      console.log('   \u23ed\ufe0f FALSE POSITIVE SKIPPED: "lecithin" is soy/sunflower-derived, not egg');
      return true;
    }
  }

  return false;
}

function checkIngredientsText(
  ingredientsText: string | undefined,
  profileAllergens: string[],
  customKeywords: string[]
): AllergenMatch[] {
  if (!ingredientsText) return [];
  
  console.log('\n\ud83d\udd2c CHECKING INGREDIENTS TEXT:');
  console.log('Ingredients:', ingredientsText.substring(0, 200));
  console.log('Profile allergens to check:', profileAllergens.join(', '));
  
  const matches: AllergenMatch[] = [];
  const normalizedText = normalizeAllergen(ingredientsText);
  const foundAllergens = new Set<string>();
  
  for (const allergen of profileAllergens) {
    console.log('\n\ud83d\udd0d Checking allergen: ' + allergen);
    const synonyms = getAllergenSynonyms(allergen);
    console.log('   Found ' + synonyms.length + ' synonyms to check');
    
    if (allergen.toLowerCase().includes('tree nut') || allergen.toLowerCase().includes('nut')) {
      console.log('   \ud83e\udd5c This is a TREE NUT allergy - extra vigilant for shea butter!');
      
      const sheaVariants = [
        'shea', 'shea butter', 'shea oil', 'sheabutter', 'sheanut', 'sheaoil',
        'butyrospermum', 'butyrospermum parkii', 'vitellaria', 'vitellaria paradoxa',
        'karite', 'karite butter'
      ];
      
      for (const sheaVariant of sheaVariants) {
        if (normalizedText.includes(sheaVariant.toLowerCase())) {
          console.log('   \u26a0\ufe0f SHEA BUTTER DETECTED: "' + sheaVariant + '" found in ingredients!');
          if (!foundAllergens.has(allergen)) {
            foundAllergens.add(allergen);
            matches.push({
              allergen: allergen,
              source: 'ingredients',
              matchedText: sheaVariant,
            });
          }
          break;
        }
      }
    }
    
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeAllergen(synonym);
      const escapedSynonym = normalizedSynonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp('\\b' + escapedSynonym + '\\b', 'i');
      
      if (wordBoundaryRegex.test(normalizedText)) {
        if (isContextualFalsePositive(normalizedText, synonym, allergen)) {
          continue;
        }
        if (!foundAllergens.has(allergen)) {
          foundAllergens.add(allergen);
          matches.push({
            allergen: allergen,
            source: 'ingredients',
            matchedText: synonym,
          });
          console.log('   \u2705 ALLERGEN DETECTED: ' + allergen + ' (matched: ' + synonym + ')');
        }
        break;
      }
    }
  }
  
  for (const keyword of customKeywords) {
    const normalizedKeyword = normalizeAllergen(keyword);
    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp('\\b' + escapedKeyword + '\\b', 'i');
    
    if (kwRegex.test(normalizedText)) {
      matches.push({
        allergen: keyword,
        source: 'custom_keyword',
        matchedText: keyword,
      });
      console.log('\u2705 CUSTOM KEYWORD DETECTED: ' + keyword);
    }
  }
  
  return matches;
}

export async function calculateVerdictEnhanced(product: Product, profile: Profile, useAI: boolean = true): Promise<EnhancedVerdict> {
  return await calculateEnhancedVerdict(product, profile, useAI);
}

export function calculateVerdict(product: Product, profile: Profile): Verdict {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551          ALLERGEN DETECTION SYSTEM                             \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
  console.log('\n\ud83d\udce6 PRODUCT:', product.product_name);
  console.log('\ud83d\udc64 PROFILE:', profile.name);
  console.log('\ud83d\udea8 PROFILE ALLERGENS:', profile.allergens.join(', '));
  console.log('\ud83d\udd11 CUSTOM KEYWORDS:', profile.customKeywords.join(', ') || 'none');
  console.log('\n\ud83d\udcdd PRODUCT DATA:');
  console.log('   Ingredients text:', product.ingredients_text ? ('"' + product.ingredients_text.substring(0, 150) + '..."') : 'NONE');
  console.log('   Allergens tags:', product.allergens_tags || 'NONE');
  console.log('   Traces tags:', product.traces_tags || 'NONE');
  console.log('   Product source:', product.source);
  
  const hasIngredients = product.ingredients_text && product.ingredients_text.trim().length > 0;
  const hasAllergenTags = product.allergens_tags && product.allergens_tags.length > 0;
  const hasTracesTags = product.traces_tags && product.traces_tags.length > 0;
  const hasAnyData = hasIngredients || hasAllergenTags || hasTracesTags;
  
  console.log('Data availability:', {
    hasIngredients,
    hasAllergenTags,
    hasTracesTags,
    hasAnyData
  });
  
  const allMatches: AllergenMatch[] = [];
  
  const allergenTagMatches = checkAllergenTags(
    product.allergens_tags,
    profile.allergens,
    'allergens_tags'
  );
  allMatches.push(...allergenTagMatches);
  
  const traceTagMatches = checkAllergenTags(
    product.traces_tags,
    profile.allergens,
    'traces_tags'
  );
  allMatches.push(...traceTagMatches);
  
  const ingredientMatches = checkIngredientsText(
    product.ingredients_text,
    profile.allergens,
    profile.customKeywords
  );
  allMatches.push(...ingredientMatches);
  
  const uniqueMatches = Array.from(
    new Map(allMatches.map(m => [m.allergen + '-' + m.source, m])).values()
  );
  
  console.log('Found matches:', uniqueMatches);
  
  let eczemaTriggers: EczemaTriggerMatch[] = [];
  if (profile.trackEczemaTriggers && profile.eczemaTriggerGroups && profile.eczemaTriggerGroups.length > 0) {
    console.log('\n\ud83e\uddf4 CHECKING SENSITIVITY TRIGGERS:');
    console.log('   Enabled trigger groups:', profile.eczemaTriggerGroups.join(', '));
    
    const skincareTriggerMatches = findEczemaTriggerMatches(
      product.ingredients_text || '',
      profile.eczemaTriggerGroups
    );
    
    eczemaTriggers = skincareTriggerMatches.map(m => ({
      triggerName: m.trigger.name,
      triggerGroup: m.trigger.triggerGroup,
      matchedText: m.matchedText,
      severityHint: m.trigger.severityHint,
    }));

    const foodTriggerMatches = findFoodSensitivityMatches(
      product.ingredients_text || '',
      profile.eczemaTriggerGroups
    );

    for (const fm of foodTriggerMatches) {
      const alreadyFound = eczemaTriggers.some(e => e.triggerName === fm.trigger.label);
      if (!alreadyFound) {
        eczemaTriggers.push({
          triggerName: fm.trigger.label,
          triggerGroup: fm.trigger.id,
          matchedText: fm.matchedKeyword,
          severityHint: 'medium',
        });
      }
    }
    
    if (eczemaTriggers.length > 0) {
      console.log('   \u26a0\ufe0f SENSITIVITY TRIGGERS FOUND:', eczemaTriggers.map(t => t.triggerName).join(', '));
    } else {
      console.log('   \u2705 No sensitivity triggers detected');
    }
  }

  if (uniqueMatches.length === 0) {
    if (eczemaTriggers.length > 0) {
      const triggerNames = eczemaTriggers.map(t => t.triggerName).join(', ');
      
      return {
        level: 'caution',
        matches: [],
        eczemaTriggers,
        message: 'No allergens found, but contains potential eczema triggers: ' + triggerNames,
        missingData: !hasAnyData,
      };
    }
    
    return {
      level: 'safe',
      matches: [],
      eczemaTriggers: [],
      message: hasAnyData 
        ? 'No listed allergens found for this profile.'
        : 'No ingredient data available - cannot verify safety.',
      missingData: !hasAnyData,
    };
  }
  
  const hasDirectAllergen = uniqueMatches.some(
    m => m.source === 'allergens_tags' || m.source === 'ingredients' || m.source === 'custom_keyword'
  );
  
  if (hasDirectAllergen) {
    const allergenList = uniqueMatches
      .filter(m => m.source !== 'traces_tags')
      .map(m => m.allergen)
      .join(', ');
    
    return {
      level: 'danger',
      matches: uniqueMatches,
      eczemaTriggers,
      message: 'Contains: ' + allergenList,
      missingData: false,
    };
  }
  
  const traceAllergenList = uniqueMatches
    .filter(m => m.source === 'traces_tags')
    .map(m => m.allergen)
    .join(', ');
  
  return {
    level: 'caution',
    matches: uniqueMatches,
    eczemaTriggers,
    message: 'May contain traces: ' + traceAllergenList,
    missingData: false,
  };
}

export function getVerdictColor(level: VerdictLevel): string {
  switch (level) {
    case 'danger':
      return '#DC2626';
    case 'caution':
      return '#F59E0B';
    case 'safe':
      return '#10B981';
  }
}

export function getVerdictIcon(level: VerdictLevel): string {
  switch (level) {
    case 'danger':
      return 'alert-circle';
    case 'caution':
      return 'alert-triangle';
    case 'safe':
      return 'check-circle';
  }
}

export function getVerdictLabel(level: VerdictLevel): string {
  switch (level) {
    case 'danger':
      return 'UNSAFE';
    case 'caution':
      return 'CAUTION';
    case 'safe':
      return 'SAFE';
  }
}
