export interface AllergenDefinition {
  name: string;
  scientificNames: string[];
  commonNames: string[];
  hiddenSources: string[];
  botanicalFamily?: string;
  crossReactivity: string[];
  inci: string[];
  cas: string[];
  eNumber: string[];
  severity: 'critical' | 'high' | 'moderate';
  notes?: string;
}

export const SCIENTIFIC_ALLERGEN_DATABASE: Record<string, AllergenDefinition> = {
  'tree nuts': {
    name: 'Tree Nuts',
    scientificNames: [
      'Juglans regia',
      'Prunus dulcis',
      'Corylus avellana',
      'Anacardium occidentale',
      'Pistacia vera',
      'Macadamia integrifolia',
      'Carya illinoinensis',
      'Castanea sativa',
      'Bertholletia excelsa',
      'Vitellaria paradoxa',
      'Butyrospermum parkii',
    ],
    commonNames: [
      'tree nut', 'tree nuts', 'almond', 'almonds', 'brazil nut', 'brazil nuts',
      'cashew', 'cashews', 'chestnut', 'chestnuts', 'hazelnut', 'hazelnuts',
      'filbert', 'filberts', 'hickory nut', 'macadamia', 'macadamia nut',
      'pecan', 'pecans', 'pine nut', 'pine nuts', 'pignoli', 'pignolia',
      'pistachio', 'pistachios', 'walnut', 'walnuts', 'beechnut', 'butternut',
      'chinquapin', 'ginkgo nut', 'lychee nut', 'shea nut', 'shea nuts',
      'nut butter', 'nut paste', 'nut oil', 'nut flour', 'nut milk',
      'marzipan', 'nougat', 'praline', 'gianduja', 'frangelico', 'amaretto',
      'natural nut extract', 'artificial nut flavoring', 'nu-nuts', 'nut meat',
    ],
    hiddenSources: [
      'shea butter', 'shea oil', 'sheabutter', 'sheanut', 'shea', 'sheaoil',
      'butyrospermum parkii', 'butyrospermum parkii butter', 'butyrospermum parkii oil',
      'vitellaria paradoxa', 'vitellaria paradoxa butter', 'vitellaria paradoxa oil',
      'karite butter', 'karite', 'karite oil', 'butyrospermum', 'vitellaria',
      'almond butter', 'almond oil', 'sweet almond oil', 'prunus amygdalus',
      'cashew butter', 'cashew cream', 'anacardium occidentale',
      'hazelnut butter', 'hazelnut oil', 'corylus avellana',
      'walnut oil', 'juglans regia', 'black walnut',
      'macadamia butter', 'macadamia ternifolia',
      'pistachio butter', 'pistacia vera',
      'pecan butter', 'carya illinoinensis',
      'coconut', 'coconut oil', 'coconut butter', 'cocos nucifera',
      'argan oil', 'argania spinosa',
      'pesto', 'mortadella', 'natural flavoring',
      'hydrolyzed vegetable protein', 'vegetable protein',
    ],
    botanicalFamily: 'Various (Juglandaceae, Rosaceae, Betulaceae, Anacardiaceae, Sapotaceae)',
    crossReactivity: ['peanuts', 'sesame', 'legumes'],
    inci: [
      'Butyrospermum Parkii', 'Butyrospermum Parkii Butter',
      'Vitellaria Paradoxa', 'Prunus Amygdalus Dulcis Oil',
      'Juglans Regia Seed Oil', 'Corylus Avellana Seed Oil',
      'Macadamia Ternifolia Seed Oil', 'Cocos Nucifera Oil',
    ],
    cas: [
      '194043-92-0',
      '8000-25-7',
      '8007-69-0',
      '8001-29-4',
    ],
    eNumber: [],
    severity: 'critical',
    notes: 'Shea butter (Butyrospermum parkii/Vitellaria paradoxa) is botanically a tree nut from the Sapotaceae family. While some highly refined versions may be tolerated by some individuals, it must be flagged for tree nut allergies.',
  },
  'peanuts': {
    name: 'Peanuts',
    scientificNames: ['Arachis hypogaea'],
    commonNames: [
      'peanut', 'peanuts', 'groundnut', 'ground nut', 'goober', 'monkey nut',
      'peanut butter', 'peanut oil', 'peanut flour', 'peanut protein',
      'beer nuts', 'mandelonas', 'nu-nuts', 'mixed nuts',
      'peanut paste', 'peanut sauce', 'satay', 'goobers',
      'valencias', 'spanish peanuts',
    ],
    hiddenSources: [
      'arachis oil', 'arachis hypogaea', 'groundnut oil',
      'hydrolyzed peanut protein', 'cold pressed peanut oil',
      'expelled peanut oil', 'extruded peanut', 'ground nuts',
      'arachis', 'goober peas', 'beer nuts',
      'artificial nuts', 'monkey nuts',
      'lupin', 'carob', 'natural flavoring',
    ],
    botanicalFamily: 'Fabaceae (Legume family)',
    crossReactivity: ['tree nuts', 'legumes', 'soybeans'],
    inci: ['Arachis Hypogaea Oil', 'Peanut Oil'],
    cas: ['8002-03-7'],
    eNumber: [],
    severity: 'critical',
    notes: 'Peanuts are legumes, not true nuts, but often cross-react with tree nuts.',
  },
  'milk': {
    name: 'Milk',
    scientificNames: ['Bos taurus', 'Capra aegagrus', 'Ovis aries'],
    commonNames: [
      'milk', 'dairy', 'casein', 'caseinate', 'whey', 'lactose',
      'lactalbumin', 'lactoglobulin', 'butter', 'buttermilk', 'cream',
      'cheese', 'yogurt', 'yoghurt', 'ghee', 'curds', 'custard', 'pudding',
      'half-and-half', 'sour cream', 'kefir', 'quark', 'recaldent',
      'simplesse', 'rennet', 'tagatose', 'nougat', 'caramel',
    ],
    hiddenSources: [
      'sodium caseinate', 'calcium caseinate', 'potassium caseinate',
      'magnesium caseinate', 'lactyc esters', 'lactylate', 'milk solids',
      'milk powder', 'milk protein', 'milk fat', 'milk derivative',
      'whey protein', 'whey powder', 'whey concentrate', 'whey isolate',
      'hydrolyzed milk protein', 'hydrolysed milk protein',
      'natural butter flavor', 'artificial butter flavor',
      'lactis', 'lac', 'lacto', 'lactic acid starter culture',
    ],
    botanicalFamily: undefined,
    crossReactivity: ['goat milk', 'sheep milk', 'beef'],
    inci: [
      'Lac', 'Lactis Proteinum', 'Whey Protein', 'Casein',
      'Sodium Caseinate', 'Calcium Caseinate',
    ],
    cas: ['9000-71-9', '9005-46-3', '9000-90-2'],
    eNumber: [],
    severity: 'high',
  },
  'eggs': {
    name: 'Eggs',
    scientificNames: ['Gallus gallus domesticus'],
    commonNames: [
      'egg', 'eggs', 'albumin', 'albumen', 'ovalbumin', 'ovomucin',
      'ovomucoid', 'ovovitellin', 'globulin', 'livetin', 'lysozyme',
      'vitellin', 'lecithin', 'egg white', 'egg yolk', 'egg powder',
      'dried egg', 'egg solids', 'egg substitute', 'eggnog', 'mayonnaise',
      'meringue', 'surimi', 'simplesse', 'apovitellin',
      'cholesterol free egg substitute', 'egg protein', 'egg lecithin',
      'whole egg', 'powdered eggs',
    ],
    hiddenSources: [
      'albuminate', 'binder', 'coagulant', 'emulsifier',
      'globulin', 'lecithin', 'livetin', 'lysozyme',
      'ovo', 'ova', 'ovomucin', 'ovomucoid', 'ovovitelia',
      'simplesse', 'trailblazer', 'vitellin', 'natural flavoring',
    ],
    botanicalFamily: undefined,
    crossReactivity: ['chicken', 'quail eggs', 'duck eggs'],
    inci: ['Albumin', 'Ovum', 'Lecithin'],
    cas: ['9006-59-1'],
    eNumber: ['E1105'],
    severity: 'high',
  },
  'fish': {
    name: 'Fish',
    scientificNames: ['Actinopterygii', 'Teleostei'],
    commonNames: [
      'fish', 'anchovy', 'anchovies', 'bass', 'catfish', 'cod', 'flounder',
      'grouper', 'haddock', 'hake', 'halibut', 'herring', 'mahi mahi',
      'perch', 'pike', 'pollock', 'salmon', 'sardine', 'sardines', 'sole',
      'snapper', 'swordfish', 'tilapia', 'trout', 'tuna',
    ],
    hiddenSources: [
      'fish sauce', 'fish oil', 'fish stock', 'fish gelatin',
      'worcestershire sauce', 'caesar dressing', 'imitation crab', 'surimi',
      'bouillabaisse', 'fish protein', 'fish extract', 'dha from fish',
      'omega-3 from fish', 'collagen', 'fish collagen',
      'anchovy paste', 'asian sauces', 'nuoc mam', 'nam pla',
    ],
    botanicalFamily: undefined,
    crossReactivity: ['shellfish'],
    inci: ['Fish Collagen', 'Fish Oil', 'Caviar Extract'],
    cas: [],
    eNumber: [],
    severity: 'critical',
  },
  'shellfish': {
    name: 'Shellfish',
    scientificNames: ['Crustacea', 'Mollusca'],
    commonNames: [
      'shellfish', 'crustacean', 'crustaceans', 'shrimp', 'prawn', 'prawns',
      'crab', 'lobster', 'crayfish', 'crawfish', 'langoustine', 'krill',
      'barnacle', 'mollusc', 'mollusk', 'clam', 'clams', 'mussel', 'mussels',
      'oyster', 'oysters', 'scallop', 'scallops', 'snail', 'snails',
      'escargot', 'squid', 'calamari', 'octopus', 'cuttlefish', 'abalone',
      'cockle', 'periwinkle', 'whelk',
    ],
    hiddenSources: [
      'glucosamine', 'chitosan', 'shellfish extract', 'shellfish flavoring',
      'crab extract', 'lobster extract', 'shrimp paste', 'fish sauce',
      'oyster sauce', 'asian sauces', 'bouillabaisse', 'paella',
      'surimi', 'imitation crab', 'seafood flavoring',
    ],
    botanicalFamily: undefined,
    crossReactivity: ['fish', 'insects', 'dust mites'],
    inci: ['Chitosan', 'Glucosamine'],
    cas: [],
    eNumber: [],
    severity: 'critical',
  },
  'wheat': {
    name: 'Wheat',
    scientificNames: ['Triticum aestivum', 'Triticum durum'],
    commonNames: [
      'wheat', 'flour', 'wheat flour', 'whole wheat', 'white flour',
      'bread flour', 'all-purpose flour', 'wheat bran', 'wheat germ',
      'wheat starch', 'wheat protein', 'gluten', 'vital wheat gluten',
      'seitan', 'bulgur', 'couscous', 'cracker meal', 'durum', 'einkorn',
      'emmer', 'farina', 'farro', 'fu', 'graham flour', 'kamut', 'matzoh',
      'matzo', 'semolina', 'spelt', 'triticale', 'wheat berries',
      'wheat grass', 'wheat germ oil', 'enriched flour', 'bromated flour',
    ],
    hiddenSources: [
      'hydrolyzed wheat protein', 'wheat maltodextrin',
      'modified wheat starch', 'wheat dextrin', 'vegetable starch',
      'gelatinized starch', 'food starch', 'natural flavoring',
      'soy sauce', 'teriyaki sauce', 'malt', 'malt extract',
      'surimi', 'imitation crab', 'modified food starch',
    ],
    botanicalFamily: 'Poaceae (Grass family)',
    crossReactivity: ['rye', 'barley', 'oats', 'grass pollen'],
    inci: ['Triticum Vulgare', 'Wheat Germ Oil', 'Hydrolyzed Wheat Protein'],
    cas: ['130498-22-5'],
    eNumber: [],
    severity: 'high',
    notes: 'Wheat allergy is different from celiac disease. Both must avoid wheat.',
  },
  'gluten': {
    name: 'Gluten',
    scientificNames: ['Triticum', 'Hordeum', 'Secale'],
    commonNames: [
      'gluten', 'wheat', 'barley', 'rye', 'malt', 'malt extract',
      'malt flavoring', 'malt syrup', 'malt vinegar', 'malted milk',
      'brewers yeast', 'wheat starch', 'wheat protein',
      'hydrolyzed wheat protein', 'triticale', 'spelt', 'kamut', 'farro',
      'bulgur', 'couscous', 'seitan', 'durum', 'semolina', 'farina',
      'graham flour', 'matzo', 'matzoh', 'beer', 'ale', 'lager',
    ],
    hiddenSources: [
      'modified food starch', 'dextrin', 'maltodextrin',
      'hydrolyzed vegetable protein', 'textured vegetable protein',
      'soy sauce', 'teriyaki sauce', 'worcestershire sauce',
      'natural flavoring', 'artificial flavoring', 'caramel color',
      'brown rice syrup', 'oats', 'oat flour', 'oatmeal',
    ],
    botanicalFamily: 'Poaceae (Grass family)',
    crossReactivity: ['wheat', 'barley', 'rye', 'oats'],
    inci: ['Hydrolyzed Wheat Protein', 'Avena Sativa'],
    cas: [],
    eNumber: [],
    severity: 'high',
    notes: 'Gluten-free diet required for celiac disease and non-celiac gluten sensitivity.',
  },
  'soybeans': {
    name: 'Soybeans',
    scientificNames: ['Glycine max'],
    commonNames: [
      'soy', 'soya', 'soybean', 'soybeans', 'soy bean', 'edamame', 'tofu',
      'tempeh', 'miso', 'natto', 'shoyu', 'tamari', 'soy sauce', 'soy milk',
      'soy protein', 'soy flour', 'soy lecithin', 'soy oil', 'soybean oil',
      'vegetable oil', 'textured vegetable protein', 'tvp',
      'soy protein isolate', 'soy protein concentrate', 'soy albumin',
      'soy fiber', 'soy grits', 'soy nuts', 'soy sprouts', 'soy yogurt',
      'yuba', 'kinako', 'okara',
    ],
    hiddenSources: [
      'glycine max', 'hydrolyzed soy protein',
      'hydrolyzed vegetable protein', 'hvp', 'lecithin',
      'mono-diglyceride', 'monosodium glutamate', 'msg', 'teriyaki',
      'vegetable broth', 'vegetable gum', 'vegetable starch',
      'natural flavoring', 'artificial flavoring',
    ],
    botanicalFamily: 'Fabaceae (Legume family)',
    crossReactivity: ['peanuts', 'legumes', 'tree nuts'],
    inci: ['Glycine Soja Oil', 'Soy Lecithin', 'Hydrolyzed Soy Protein'],
    cas: ['8001-22-7'],
    eNumber: ['E322'],
    severity: 'high',
  },
  'sesame': {
    name: 'Sesame',
    scientificNames: ['Sesamum indicum'],
    commonNames: [
      'sesame', 'sesame seed', 'sesame seeds', 'tahini', 'tahina',
      'sesame oil', 'sesame paste', 'sesamol', 'sesamolina', 'benne',
      'benne seed', 'benniseed', 'gingelly', 'gingelly oil', 'til', 'simsim',
      'sesame flour', 'sesame salt', 'gomasio', 'gomashio', 'halvah', 'halva',
      'hummus', 'baba ganoush', 'sesame butter',
    ],
    hiddenSources: [
      'sesamum indicum', 'gingelly oil', 'til oil',
      'vegetable oil', 'natural flavoring', 'spice blend',
      'bagels', 'baked goods', 'breadsticks', 'crackers',
      'tempeh', 'vegetable oil', 'flavoring',
    ],
    botanicalFamily: 'Pedaliaceae',
    crossReactivity: ['tree nuts', 'peanuts', 'seeds'],
    inci: ['Sesamum Indicum Seed Oil', 'Sesame Oil'],
    cas: ['8008-74-0'],
    eNumber: [],
    severity: 'high',
    notes: 'Sesame is now a major allergen in the US as of 2023.',
  },
  'mustard': {
    name: 'Mustard',
    scientificNames: ['Brassica nigra', 'Brassica juncea', 'Sinapis alba'],
    commonNames: [
      'mustard', 'mustard seed', 'mustard seeds', 'mustard powder',
      'mustard flour', 'mustard oil', 'mustard greens', 'mustard sauce',
      'dijon mustard', 'yellow mustard', 'brown mustard', 'black mustard',
      'white mustard', 'oriental mustard', 'indian mustard', 'mustard bran',
      'brassica', 'sinapis alba',
    ],
    hiddenSources: [
      'spice blend', 'curry powder', 'condiments', 'dressings',
      'mayonnaise', 'salad dressing', 'barbecue sauce',
      'natural flavoring', 'spice',
    ],
    botanicalFamily: 'Brassicaceae (Cabbage family)',
    crossReactivity: ['other brassicas'],
    inci: ['Brassica Nigra', 'Sinapis Alba'],
    cas: [],
    eNumber: [],
    severity: 'moderate',
  },
  'celery': {
    name: 'Celery',
    scientificNames: ['Apium graveolens'],
    commonNames: [
      'celery', 'celery seed', 'celery seeds', 'celery salt', 'celery root',
      'celeriac', 'celery stalk', 'celery leaves', 'celery powder',
      'celery extract', 'celery oil', 'celery flavoring', 'apium graveolens',
      'celery juice',
    ],
    hiddenSources: [
      'vegetable broth', 'vegetable stock', 'spice blend',
      'natural flavoring', 'soup', 'bouillon',
    ],
    botanicalFamily: 'Apiaceae (Carrot family)',
    crossReactivity: ['carrots', 'parsley', 'birch pollen'],
    inci: ['Apium Graveolens Extract'],
    cas: [],
    eNumber: [],
    severity: 'moderate',
  },
  'lupin': {
    name: 'Lupin',
    scientificNames: ['Lupinus albus', 'Lupinus angustifolius'],
    commonNames: [
      'lupin', 'lupine', 'lupini', 'lupin bean', 'lupin beans', 'lupin flour',
      'lupin protein', 'lupin seed', 'lupin seeds', 'lupinus', 'lupinus albus',
      'lupin fiber', 'lupin fibre',
    ],
    hiddenSources: [
      'lupine flour', 'gluten-free flour', 'high-protein flour',
      'vegetable protein', 'pasta', 'baked goods',
    ],
    botanicalFamily: 'Fabaceae (Legume family)',
    crossReactivity: ['peanuts', 'soybeans', 'legumes'],
    inci: ['Lupinus Albus Seed Extract'],
    cas: [],
    eNumber: [],
    severity: 'moderate',
  },
  'sulfites': {
    name: 'Sulfites',
    scientificNames: [],
    commonNames: [
      'sulfite', 'sulfites', 'sulphite', 'sulphites', 'sulfur dioxide',
      'sulphur dioxide', 'sodium sulfite', 'sodium bisulfite',
      'sodium metabisulfite', 'potassium bisulfite', 'potassium metabisulfite',
      'calcium sulfite', 'calcium bisulfite', 'sulfiting agent',
      'sulphiting agent',
    ],
    hiddenSources: [
      'dried fruits', 'wine', 'beer', 'cider', 'vinegar',
      'pickled foods', 'canned foods', 'frozen potatoes',
      'shrimp', 'lobster', 'fruit juices', 'molasses',
      'corn syrup', 'maple syrup', 'jams', 'jellies',
    ],
    botanicalFamily: undefined,
    crossReactivity: [],
    inci: ['Sodium Sulfite', 'Sodium Metabisulfite'],
    cas: ['7757-83-7', '7681-57-4'],
    eNumber: ['E220', 'E221', 'E222', 'E223', 'E224', 'E225', 'E226', 'E227', 'E228'],
    severity: 'moderate',
    notes: 'Particularly dangerous for people with asthma.',
  },
};

export const ALLERGEN_CROSS_REACTIVITY: Record<string, string[]> = {
  'tree nuts': ['peanuts', 'sesame', 'legumes', 'coconut'],
  'peanuts': ['tree nuts', 'legumes', 'soybeans', 'lupin'],
  'milk': ['goat milk', 'sheep milk', 'beef', 'gelatin'],
  'eggs': ['chicken', 'quail eggs', 'duck eggs', 'feathers'],
  'fish': ['shellfish', 'fish gelatin', 'omega-3 supplements'],
  'shellfish': ['fish', 'insects', 'dust mites'],
  'wheat': ['rye', 'barley', 'oats', 'grass pollen', 'gluten'],
  'gluten': ['wheat', 'barley', 'rye', 'oats', 'malt'],
  'soybeans': ['peanuts', 'legumes', 'tree nuts'],
  'sesame': ['tree nuts', 'peanuts', 'seeds', 'poppy seeds'],
  'mustard': ['cabbage', 'broccoli', 'cauliflower', 'kale'],
  'celery': ['carrots', 'parsley', 'coriander', 'birch pollen', 'mugwort'],
  'lupin': ['peanuts', 'soybeans', 'legumes', 'lentils', 'chickpeas'],
  'sulfites': [],
};

export const CRITICAL_INGREDIENTS_REGEX = {
  shea: /\b(shea|sheabutter|sheaoil|sheanut|shea\s*butter|shea\s*oil|shea\s*nut|karite|butyrospermum|vitellaria)\b/i,
  coconut: /\b(coconut|cocos nucifera|coco|copra)\b/i,
  almond: /\b(almond|prunus amygdalus|prunus dulcis|sweet almond)\b/i,
  walnut: /\b(walnut|juglans regia|black walnut)\b/i,
  cashew: /\b(cashew|anacardium occidentale)\b/i,
  hazelnut: /\b(hazelnut|filbert|corylus avellana)\b/i,
  pistachio: /\b(pistachio|pistacia vera)\b/i,
  macadamia: /\b(macadamia|macadamia ternifolia)\b/i,
  pecan: /\b(pecan|carya illinoinensis)\b/i,
  wheat: /\b(wheat|triticum|gluten|flour|bread|pasta|couscous|bulgur|semolina|durum|spelt|kamut|farro)\b/i,
  gelatin: /\b(gelatin|gelatine)\b/i,
};

export function getAllSynonymsForAllergen(allergen: string): string[] {
  const normalized = allergen.toLowerCase().trim();
  
  for (const [key, definition] of Object.entries(SCIENTIFIC_ALLERGEN_DATABASE)) {
    if (normalized === key || definition.name.toLowerCase() === normalized) {
      return [
        ...definition.commonNames,
        ...definition.hiddenSources,
        ...definition.scientificNames,
        ...definition.inci,
      ];
    }
  }
  
  return [allergen];
}

export function getAllergenDefinition(allergen: string): AllergenDefinition | null {
  const normalized = allergen.toLowerCase().trim();
  
  for (const [key, definition] of Object.entries(SCIENTIFIC_ALLERGEN_DATABASE)) {
    if (normalized === key || definition.name.toLowerCase() === normalized) {
      return definition;
    }
  }
  
  return null;
}

export function getCrossReactiveAllergens(allergen: string): string[] {
  const normalized = allergen.toLowerCase().trim();
  
  for (const [key, crossReactive] of Object.entries(ALLERGEN_CROSS_REACTIVITY)) {
    if (normalized === key || normalized.includes(key) || key.includes(normalized)) {
      return crossReactive;
    }
  }
  
  return [];
}

export function isIngredientAllergen(ingredient: string, allergen: string): boolean {
  const normalizedIngredient = ingredient.toLowerCase().trim();
  const normalizedAllergen = allergen.toLowerCase().trim();
  
  const definition = getAllergenDefinition(normalizedAllergen);
  if (!definition) return false;
  
  const allSynonyms = [
    ...definition.commonNames,
    ...definition.hiddenSources,
    ...definition.scientificNames.map(s => s.toLowerCase()),
    ...definition.inci.map(i => i.toLowerCase()),
  ];
  
  for (const synonym of allSynonyms) {
    const normalizedSynonym = synonym.toLowerCase();
    
    const escapedSynonym = normalizedSynonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRegex = new RegExp(`\\b${escapedSynonym}\\b`, 'i');
    
    if (wordBoundaryRegex.test(normalizedIngredient)) {
      return true;
    }
    
    if (normalizedIngredient.includes(normalizedSynonym) || normalizedSynonym.includes(normalizedIngredient)) {
      return true;
    }
  }
  
  const criticalMatches = [
    { regex: CRITICAL_INGREDIENTS_REGEX.shea, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.coconut, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.almond, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.walnut, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.cashew, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.hazelnut, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.pistachio, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.macadamia, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.pecan, allergen: 'tree nuts' },
    { regex: CRITICAL_INGREDIENTS_REGEX.wheat, allergen: 'wheat' },
  ];
  
  for (const { regex, allergen: criticalAllergen } of criticalMatches) {
    if (regex.test(normalizedIngredient) && normalizedAllergen.includes(criticalAllergen)) {
      return true;
    }
  }
  
  return false;
}
