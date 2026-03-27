export interface IngredientInfo {
  name: string;
  category: 'natural' | 'processed' | 'additive' | 'preservative' | 'artificial' | 'unknown';
  safetyRating: 'safe' | 'moderate' | 'concerning' | 'harmful';
  concerns: string[];
  description: string;
  commonUses: string[];
}

const HARMFUL_INGREDIENTS: Record<string, IngredientInfo> = {
  'high fructose corn syrup': {
    name: 'High Fructose Corn Syrup',
    category: 'processed',
    safetyRating: 'harmful',
    concerns: [
      'Linked to obesity and metabolic syndrome',
      'May increase risk of type 2 diabetes',
      'Can contribute to fatty liver disease',
      'Associated with increased inflammation'
    ],
    description: 'A highly processed sweetener made from corn starch. It is sweeter and cheaper than regular sugar.',
    commonUses: ['Sodas', 'Candy', 'Baked goods', 'Processed foods']
  },
  'monosodium glutamate': {
    name: 'Monosodium Glutamate (MSG)',
    category: 'additive',
    safetyRating: 'concerning',
    concerns: [
      'May cause headaches in sensitive individuals',
      'Can trigger allergic-like reactions',
      'Associated with "Chinese Restaurant Syndrome"',
      'May affect neurological function in high doses'
    ],
    description: 'A flavor enhancer that intensifies the savory taste of foods.',
    commonUses: ['Chinese food', 'Chips', 'Canned soups', 'Processed meats']
  },
  'msg': {
    name: 'MSG (Monosodium Glutamate)',
    category: 'additive',
    safetyRating: 'concerning',
    concerns: [
      'May cause headaches in sensitive individuals',
      'Can trigger allergic-like reactions',
      'Associated with "Chinese Restaurant Syndrome"',
      'May affect neurological function in high doses'
    ],
    description: 'A flavor enhancer that intensifies the savory taste of foods.',
    commonUses: ['Chinese food', 'Chips', 'Canned soups', 'Processed meats']
  },
  'sodium nitrite': {
    name: 'Sodium Nitrite',
    category: 'preservative',
    safetyRating: 'harmful',
    concerns: [
      'Can form carcinogenic nitrosamines when heated',
      'Linked to increased cancer risk',
      'May affect oxygen transport in blood',
      'Particularly concerning in processed meats'
    ],
    description: 'A preservative and color fixative used primarily in cured meats.',
    commonUses: ['Bacon', 'Hot dogs', 'Deli meats', 'Sausages']
  },
  'sodium nitrate': {
    name: 'Sodium Nitrate',
    category: 'preservative',
    safetyRating: 'harmful',
    concerns: [
      'Converts to sodium nitrite in the body',
      'Can form carcinogenic compounds',
      'Linked to increased cancer risk',
      'May affect cardiovascular health'
    ],
    description: 'A preservative used in cured and processed meats.',
    commonUses: ['Cured meats', 'Bacon', 'Salami', 'Jerky']
  },
  'artificial colors': {
    name: 'Artificial Food Colors',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause hyperactivity in children',
      'Some linked to cancer in animal studies',
      'Can trigger allergic reactions',
      'Banned in some countries'
    ],
    description: 'Synthetic dyes used to enhance food appearance.',
    commonUses: ['Candy', 'Beverages', 'Baked goods', 'Cereals']
  },
  'red 40': {
    name: 'Red 40 (Allura Red)',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause hyperactivity in children',
      'Linked to allergic reactions',
      'Contains benzene, a carcinogen',
      'Banned in several European countries'
    ],
    description: 'The most widely used artificial food dye in the United States.',
    commonUses: ['Candy', 'Soft drinks', 'Cereals', 'Snack foods']
  },
  'yellow 5': {
    name: 'Yellow 5 (Tartrazine)',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause allergic reactions',
      'Linked to hyperactivity in children',
      'Can trigger asthma symptoms',
      'Requires warning labels in EU'
    ],
    description: 'A synthetic lemon yellow dye used in many processed foods.',
    commonUses: ['Candy', 'Soft drinks', 'Chips', 'Desserts']
  },
  'yellow 6': {
    name: 'Yellow 6 (Sunset Yellow)',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause hyperactivity in children',
      'Linked to allergic reactions',
      'Can cause tumors in animal studies',
      'Requires warning labels in EU'
    ],
    description: 'An artificial orange-yellow dye used in foods and beverages.',
    commonUses: ['Candy', 'Cereals', 'Beverages', 'Baked goods']
  },
  'blue 1': {
    name: 'Blue 1 (Brilliant Blue)',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause allergic reactions',
      'Linked to hyperactivity',
      'Can cross blood-brain barrier',
      'Potential neurotoxic effects'
    ],
    description: 'A synthetic blue dye used in foods, beverages, and cosmetics.',
    commonUses: ['Candy', 'Ice cream', 'Beverages', 'Baked goods']
  },
  'blue 2': {
    name: 'Blue 2 (Indigo Carmine)',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause brain tumors in animal studies',
      'Linked to allergic reactions',
      'Can affect behavior in children',
      'Banned in some countries'
    ],
    description: 'A synthetic blue dye used in foods and pet foods.',
    commonUses: ['Candy', 'Beverages', 'Pet food', 'Baked goods']
  },
  'bha': {
    name: 'BHA (Butylated Hydroxyanisole)',
    category: 'preservative',
    safetyRating: 'harmful',
    concerns: [
      'Classified as possible human carcinogen',
      'May disrupt hormones',
      'Linked to cancer in animal studies',
      'Banned in some countries'
    ],
    description: 'A synthetic antioxidant used to prevent fats from going rancid.',
    commonUses: ['Cereals', 'Chips', 'Chewing gum', 'Preserved meats']
  },
  'bht': {
    name: 'BHT (Butylated Hydroxytoluene)',
    category: 'preservative',
    safetyRating: 'harmful',
    concerns: [
      'May be carcinogenic',
      'Can disrupt hormones',
      'Linked to organ toxicity',
      'Banned in some countries'
    ],
    description: 'A synthetic antioxidant used to preserve fats and oils.',
    commonUses: ['Cereals', 'Chips', 'Preserved foods', 'Cosmetics']
  },
  'tbhq': {
    name: 'TBHQ (Tertiary Butylhydroquinone)',
    category: 'preservative',
    safetyRating: 'concerning',
    concerns: [
      'May cause vision disturbances',
      'Linked to stomach tumors in animal studies',
      'Can affect immune system',
      'May cause nausea and vomiting in high doses'
    ],
    description: 'A synthetic preservative used to extend shelf life of foods.',
    commonUses: ['Crackers', 'Chips', 'Frozen foods', 'Fast food']
  },
  'partially hydrogenated oil': {
    name: 'Partially Hydrogenated Oil',
    category: 'processed',
    safetyRating: 'harmful',
    concerns: [
      'Contains trans fats',
      'Increases bad cholesterol (LDL)',
      'Decreases good cholesterol (HDL)',
      'Linked to heart disease and stroke',
      'Banned by FDA in the US'
    ],
    description: 'An artificial fat created by adding hydrogen to vegetable oil.',
    commonUses: ['Margarine', 'Baked goods', 'Fried foods', 'Snack foods']
  },
  'trans fat': {
    name: 'Trans Fat',
    category: 'processed',
    safetyRating: 'harmful',
    concerns: [
      'Increases risk of heart disease',
      'Raises bad cholesterol',
      'Lowers good cholesterol',
      'Linked to inflammation',
      'Banned in many countries'
    ],
    description: 'Artificial fats created through hydrogenation process.',
    commonUses: ['Fried foods', 'Baked goods', 'Margarine', 'Processed snacks']
  },
  'aspartame': {
    name: 'Aspartame',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May cause headaches and migraines',
      'Linked to neurological issues',
      'Can trigger allergic reactions',
      'Controversial safety profile',
      'Breaks down into methanol'
    ],
    description: 'An artificial sweetener 200 times sweeter than sugar.',
    commonUses: ['Diet sodas', 'Sugar-free gum', 'Low-calorie desserts', 'Tabletop sweeteners']
  },
  'sucralose': {
    name: 'Sucralose',
    category: 'artificial',
    safetyRating: 'moderate',
    concerns: [
      'May alter gut bacteria',
      'Can affect insulin response',
      'Limited long-term safety data',
      'May produce harmful compounds when heated'
    ],
    description: 'An artificial sweetener made from sugar but 600 times sweeter.',
    commonUses: ['Diet beverages', 'Sugar-free products', 'Baked goods', 'Protein bars']
  },
  'acesulfame potassium': {
    name: 'Acesulfame Potassium (Ace-K)',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May affect prenatal development',
      'Limited safety testing',
      'Can affect gut bacteria',
      'May increase appetite'
    ],
    description: 'An artificial sweetener often used in combination with other sweeteners.',
    commonUses: ['Diet sodas', 'Sugar-free products', 'Protein shakes', 'Baked goods']
  },
  'potassium bromate': {
    name: 'Potassium Bromate',
    category: 'additive',
    safetyRating: 'harmful',
    concerns: [
      'Classified as possible human carcinogen',
      'Linked to kidney and thyroid tumors',
      'Banned in EU, Canada, and many countries',
      'May cause DNA damage'
    ],
    description: 'A flour improver that strengthens dough.',
    commonUses: ['Bread', 'Rolls', 'Bagels', 'Baked goods']
  },
  'propyl gallate': {
    name: 'Propyl Gallate',
    category: 'preservative',
    safetyRating: 'concerning',
    concerns: [
      'May cause allergic reactions',
      'Linked to liver and kidney problems',
      'Possible endocrine disruptor',
      'Can cause stomach irritation'
    ],
    description: 'An antioxidant used to prevent fats and oils from spoiling.',
    commonUses: ['Meat products', 'Vegetable oils', 'Chewing gum', 'Snack foods']
  },
  'sodium benzoate': {
    name: 'Sodium Benzoate',
    category: 'preservative',
    safetyRating: 'moderate',
    concerns: [
      'Can form benzene (carcinogen) when combined with vitamin C',
      'May cause hyperactivity in children',
      'Linked to allergic reactions',
      'Can damage DNA in mitochondria'
    ],
    description: 'A preservative that prevents growth of bacteria, mold, and yeast.',
    commonUses: ['Soft drinks', 'Fruit juices', 'Pickles', 'Condiments']
  },
  'carrageenan': {
    name: 'Carrageenan',
    category: 'additive',
    safetyRating: 'concerning',
    concerns: [
      'May cause digestive inflammation',
      'Linked to intestinal damage in animal studies',
      'Can trigger immune response',
      'May worsen inflammatory bowel disease'
    ],
    description: 'A thickening agent extracted from red seaweed.',
    commonUses: ['Dairy products', 'Plant-based milks', 'Ice cream', 'Deli meats']
  },
  'caramel color': {
    name: 'Caramel Color',
    category: 'artificial',
    safetyRating: 'concerning',
    concerns: [
      'May contain 4-MEI, a possible carcinogen',
      'Linked to immune system issues',
      'Can cause allergic reactions',
      'Different types have varying safety profiles'
    ],
    description: 'A coloring agent made by heating sugars, often with chemicals.',
    commonUses: ['Sodas', 'Beer', 'Soy sauce', 'Baked goods']
  },
};

export function analyzeIngredient(ingredient: string): IngredientInfo {
  const normalized = ingredient.toLowerCase().trim();
  
  for (const [key, info] of Object.entries(HARMFUL_INGREDIENTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return info;
    }
  }
  
  if (normalized.includes('color') || normalized.includes('dye') || /red \d+|yellow \d+|blue \d+/.test(normalized)) {
    return {
      name: ingredient,
      category: 'artificial',
      safetyRating: 'concerning',
      concerns: ['Artificial coloring', 'May cause allergic reactions', 'Linked to hyperactivity in children'],
      description: 'An artificial food coloring agent.',
      commonUses: ['Processed foods', 'Candy', 'Beverages']
    };
  }
  
  if (normalized.includes('artificial') || normalized.includes('synthetic')) {
    return {
      name: ingredient,
      category: 'artificial',
      safetyRating: 'concerning',
      concerns: ['Artificial ingredient', 'May have unknown long-term effects'],
      description: 'A synthetic or artificial ingredient.',
      commonUses: ['Processed foods']
    };
  }
  
  if (normalized.includes('preservative') || normalized.includes('e2') || normalized.includes('e3')) {
    return {
      name: ingredient,
      category: 'preservative',
      safetyRating: 'moderate',
      concerns: ['Preservative', 'May cause sensitivity in some individuals'],
      description: 'A preservative used to extend shelf life.',
      commonUses: ['Processed foods']
    };
  }
  
  return {
    name: ingredient,
    category: 'unknown',
    safetyRating: 'safe',
    concerns: [],
    description: 'No specific safety concerns identified.',
    commonUses: []
  };
}

export function parseIngredients(ingredientsText: string): string[] {
  if (!ingredientsText) return [];
  
  const cleaned = ingredientsText
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '');
  
  const ingredients = cleaned
    .split(/[,;]/)
    .map(i => i.trim())
    .filter(i => i.length > 0);
  
  return ingredients;
}

export function getOverallSafetyScore(ingredients: IngredientInfo[]): {
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'very poor';
  harmfulCount: number;
  concerningCount: number;
} {
  let score = 100;
  let harmfulCount = 0;
  let concerningCount = 0;
  
  for (const ingredient of ingredients) {
    if (ingredient.safetyRating === 'harmful') {
      score -= 15;
      harmfulCount++;
    } else if (ingredient.safetyRating === 'concerning') {
      score -= 8;
      concerningCount++;
    } else if (ingredient.safetyRating === 'moderate') {
      score -= 3;
    }
  }
  
  score = Math.max(0, score);
  
  let rating: 'excellent' | 'good' | 'fair' | 'poor' | 'very poor';
  if (score >= 90) rating = 'excellent';
  else if (score >= 75) rating = 'good';
  else if (score >= 60) rating = 'fair';
  else if (score >= 40) rating = 'poor';
  else rating = 'very poor';
  
  return { score, rating, harmfulCount, concerningCount };
}
