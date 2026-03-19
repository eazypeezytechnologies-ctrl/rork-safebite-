export interface CanonicalIngredient {
  canonical: string;
  aliases: string[];
  category: 'allergen' | 'additive' | 'preservative' | 'emulsifier' | 'sweetener' | 'fat' | 'protein' | 'other';
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export const CANONICAL_INGREDIENTS: CanonicalIngredient[] = [
  {
    canonical: 'milk',
    aliases: [
      'milk', 'dairy', 'casein', 'caseinate', 'whey', 'lactose', 'lactalbumin',
      'lactoglobulin', 'butter', 'buttermilk', 'cream', 'cheese', 'yogurt', 'yoghurt',
      'ghee', 'curds', 'custard', 'half-and-half', 'sour cream', 'kefir', 'quark',
      'sodium caseinate', 'calcium caseinate', 'potassium caseinate', 'milk solids',
      'milk powder', 'milk protein', 'milk fat', 'whey protein', 'whey powder',
      'hydrolyzed milk protein', 'hydrolysed milk protein', 'lactulose', 'recaldent',
      'simplesse', 'rennet', 'nougat', 'milk derivative', 'whey concentrate',
      'condensed milk', 'evaporated milk', 'powdered milk', 'skimmed milk',
      'whole milk', 'semi-skimmed milk', 'butterfat', 'milk chocolate',
      'lait', 'milch', 'leche', 'molke', 'fromage', 'queso',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'eggs',
    aliases: [
      'egg', 'eggs', 'albumin', 'albumen', 'ovalbumin', 'ovomucin', 'ovomucoid',
      'ovovitellin', 'globulin', 'livetin', 'lysozyme', 'vitellin',
      'egg white', 'egg yolk', 'egg powder', 'dried egg', 'egg solids',
      'eggnog', 'mayonnaise', 'meringue', 'surimi', 'apovitellin',
      'egg protein', 'egg lecithin', 'whole egg', 'powdered eggs',
      'oeuf', 'ei', 'huevo', 'ovum', 'ovo',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'peanuts',
    aliases: [
      'peanut', 'peanuts', 'groundnut', 'ground nut', 'goober', 'monkey nut',
      'peanut butter', 'peanut oil', 'peanut flour', 'peanut protein',
      'arachis oil', 'arachis hypogaea', 'beer nuts', 'mandelonas',
      'mixed nuts', 'peanut paste', 'peanut sauce', 'satay',
      'hydrolyzed peanut protein', 'arachis', 'cacahuete', 'erdnuss',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'tree nuts',
    aliases: [
      'tree nut', 'tree nuts', 'almond', 'almonds', 'brazil nut', 'cashew', 'cashews',
      'chestnut', 'chestnuts', 'hazelnut', 'hazelnuts', 'filbert', 'macadamia',
      'pecan', 'pecans', 'pine nut', 'pine nuts', 'pistachio', 'pistachios',
      'walnut', 'walnuts', 'beechnut', 'butternut', 'shea nut', 'shea butter',
      'shea oil', 'butyrospermum parkii', 'vitellaria paradoxa', 'karite',
      'coconut', 'nut butter', 'nut paste', 'nut oil', 'nut flour', 'nut milk',
      'marzipan', 'praline', 'gianduja', 'frangelico', 'amaretto',
      'almond butter', 'almond oil', 'cashew butter', 'cashew cream',
      'hazelnut oil', 'walnut oil', 'macadamia butter', 'pistachio butter',
      'noix', 'nuss', 'nuez', 'mandel', 'noisette',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'wheat',
    aliases: [
      'wheat', 'wheat flour', 'whole wheat', 'bread flour', 'all-purpose flour',
      'wheat bran', 'wheat germ', 'wheat starch', 'wheat protein', 'vital wheat gluten',
      'seitan', 'bulgur', 'couscous', 'durum', 'einkorn', 'emmer', 'farina',
      'farro', 'graham flour', 'kamut', 'semolina', 'spelt', 'triticale',
      'wheat berries', 'hydrolyzed wheat protein', 'wheat maltodextrin',
      'modified wheat starch', 'enriched flour', 'enriched wheat flour',
      'bleached flour', 'unbleached flour', 'self-rising flour', 'cake flour',
      'pastry flour', 'cracker meal', 'matzo', 'matzoh',
      'ble', 'weizen', 'trigo', 'froment',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'gluten',
    aliases: [
      'gluten', 'wheat', 'barley', 'rye', 'malt', 'malt extract', 'malt flavoring',
      'malt syrup', 'malt vinegar', 'malted milk', 'brewers yeast', 'triticale',
      'spelt', 'kamut', 'farro', 'bulgur', 'couscous', 'seitan', 'durum',
      'semolina', 'farina', 'graham flour',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'soybeans',
    aliases: [
      'soy', 'soya', 'soybean', 'soybeans', 'edamame', 'tofu', 'tempeh',
      'miso', 'natto', 'shoyu', 'tamari', 'soy sauce', 'soy milk', 'soy protein',
      'soy flour', 'soy lecithin', 'soy oil', 'soybean oil',
      'textured soy protein', 'tvp', 'hydrolyzed soy protein',
      'soy protein isolate', 'soy protein concentrate', 'soy albumin',
      'soy fiber', 'soy grits', 'glycine max', 'teriyaki',
      'soja', 'soia',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'fish',
    aliases: [
      'fish', 'anchovy', 'anchovies', 'bass', 'catfish', 'cod', 'flounder',
      'haddock', 'halibut', 'herring', 'mahi mahi', 'perch', 'pike', 'pollock',
      'salmon', 'sardine', 'sardines', 'sole', 'snapper', 'swordfish', 'tilapia',
      'trout', 'tuna', 'fish sauce', 'fish oil', 'fish stock', 'fish gelatin',
      'worcestershire sauce', 'caesar dressing', 'surimi', 'fish protein',
      'fish extract', 'poisson', 'fisch', 'pescado',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'shellfish',
    aliases: [
      'shellfish', 'crustacean', 'crustaceans', 'shrimp', 'prawn', 'prawns',
      'crab', 'lobster', 'crayfish', 'crawfish', 'langoustine', 'krill',
      'mollusk', 'mollusc', 'clam', 'clams', 'mussel', 'mussels', 'oyster',
      'oysters', 'scallop', 'scallops', 'squid', 'calamari', 'octopus',
      'cuttlefish', 'abalone', 'cockle', 'glucosamine', 'chitosan',
      'shrimp paste', 'crabe', 'crevette', 'garnele',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'sesame',
    aliases: [
      'sesame', 'sesame seed', 'sesame seeds', 'tahini', 'tahina', 'sesame oil',
      'sesame paste', 'benne', 'benne seed', 'benniseed', 'gingelly',
      'gingelly oil', 'til', 'simsim', 'sesame flour', 'gomasio', 'gomashio',
      'halvah', 'halva', 'hummus', 'sesame butter', 'sesamum indicum',
    ],
    category: 'allergen',
    riskLevel: 'high',
  },
  {
    canonical: 'mustard',
    aliases: [
      'mustard', 'mustard seed', 'mustard powder', 'mustard flour', 'mustard oil',
      'mustard greens', 'dijon mustard', 'yellow mustard', 'brown mustard',
      'sinapis alba', 'brassica', 'moutarde', 'senf',
    ],
    category: 'allergen',
    riskLevel: 'medium',
  },
  {
    canonical: 'celery',
    aliases: [
      'celery', 'celery seed', 'celery salt', 'celery root', 'celeriac',
      'celery powder', 'celery extract', 'celery oil', 'celery juice',
      'apium graveolens', 'sellerie', 'celeri',
    ],
    category: 'allergen',
    riskLevel: 'medium',
  },
  {
    canonical: 'lupin',
    aliases: [
      'lupin', 'lupine', 'lupini', 'lupin bean', 'lupin flour',
      'lupin protein', 'lupin seed', 'lupinus', 'lupinus albus',
    ],
    category: 'allergen',
    riskLevel: 'medium',
  },
  {
    canonical: 'sulfites',
    aliases: [
      'sulfite', 'sulfites', 'sulphite', 'sulphites', 'sulfur dioxide',
      'sulphur dioxide', 'sodium sulfite', 'sodium bisulfite',
      'sodium metabisulfite', 'potassium bisulfite', 'potassium metabisulfite',
      'calcium sulfite', 'e220', 'e221', 'e222', 'e223', 'e224', 'e225',
      'e226', 'e227', 'e228',
    ],
    category: 'allergen',
    riskLevel: 'medium',
  },
  {
    canonical: 'corn',
    aliases: [
      'corn', 'maize', 'corn flour', 'corn starch', 'cornstarch', 'corn syrup',
      'high fructose corn syrup', 'corn oil', 'corn meal', 'cornmeal',
      'corn gluten', 'dextrose', 'maltodextrin', 'corn protein', 'zein',
      'polenta', 'grits', 'hominy', 'masa',
    ],
    category: 'allergen',
    riskLevel: 'medium',
  },
  {
    canonical: 'glycerin',
    aliases: [
      'glycerin', 'glycerine', 'glycerol', 'vegetable glycerin',
      'vegetable glycerine',
    ],
    category: 'emulsifier',
    riskLevel: 'low',
  },
  {
    canonical: 'lecithin',
    aliases: [
      'lecithin', 'soy lecithin', 'sunflower lecithin', 'egg lecithin',
      'lecithine', 'e322',
    ],
    category: 'emulsifier',
    riskLevel: 'low',
  },
  {
    canonical: 'gelatin',
    aliases: [
      'gelatin', 'gelatine', 'porcine gelatin', 'bovine gelatin', 'fish gelatin',
      'hydrolyzed gelatin', 'collagen hydrolysate',
    ],
    category: 'protein',
    riskLevel: 'medium',
  },
];

export function normalizeIngredientName(raw: string): string {
  const cleaned = raw.toLowerCase().trim().replace(/\s+/g, ' ');

  for (const entry of CANONICAL_INGREDIENTS) {
    for (const alias of entry.aliases) {
      if (cleaned === alias.toLowerCase()) {
        return entry.canonical;
      }
    }
  }

  return cleaned;
}

export function findCanonicalMatch(ingredientText: string): CanonicalIngredient | null {
  const cleaned = ingredientText.toLowerCase().trim();

  for (const entry of CANONICAL_INGREDIENTS) {
    for (const alias of entry.aliases) {
      const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(cleaned)) {
        return entry;
      }
    }
  }

  return null;
}

export function resolveAllAliases(allergenName: string): string[] {
  const normalized = allergenName.toLowerCase().trim();

  for (const entry of CANONICAL_INGREDIENTS) {
    if (entry.canonical === normalized) {
      return entry.aliases;
    }
    for (const alias of entry.aliases) {
      if (alias.toLowerCase() === normalized) {
        return entry.aliases;
      }
    }
  }

  return [normalized];
}

export function isKnownAllergen(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return CANONICAL_INGREDIENTS.some(
    entry =>
      entry.category === 'allergen' &&
      (entry.canonical === normalized ||
        entry.aliases.some(a => a.toLowerCase() === normalized))
  );
}
