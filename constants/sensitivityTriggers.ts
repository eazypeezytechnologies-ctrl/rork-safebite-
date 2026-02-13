export interface FoodSensitivityTrigger {
  id: string;
  label: string;
  keywords: string[];
  icon: string;
}

export const FOOD_SENSITIVITY_TRIGGERS: FoodSensitivityTrigger[] = [
  {
    id: 'dairy',
    label: 'Dairy',
    keywords: ['dairy', 'milk', 'cream', 'cheese', 'butter', 'yogurt', 'whey', 'casein', 'lactose', 'ghee'],
    icon: '🥛',
  },
  {
    id: 'eggs',
    label: 'Eggs',
    keywords: ['egg', 'eggs', 'albumin', 'ovalbumin', 'lecithin', 'mayonnaise'],
    icon: '🥚',
  },
  {
    id: 'gluten_wheat',
    label: 'Gluten / Wheat',
    keywords: ['gluten', 'wheat', 'barley', 'rye', 'spelt', 'semolina', 'flour', 'malt', 'seitan', 'couscous'],
    icon: '🌾',
  },
  {
    id: 'soy',
    label: 'Soy',
    keywords: ['soy', 'soya', 'soybean', 'tofu', 'tempeh', 'miso', 'edamame', 'soy lecithin', 'soy sauce'],
    icon: '🫘',
  },
  {
    id: 'nuts',
    label: 'Nuts',
    keywords: ['nut', 'nuts', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'peanut'],
    icon: '🥜',
  },
  {
    id: 'citrus',
    label: 'Citrus',
    keywords: ['citrus', 'orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'citric acid', 'mandarin'],
    icon: '🍊',
  },
  {
    id: 'tomatoes',
    label: 'Tomatoes',
    keywords: ['tomato', 'tomatoes', 'tomato paste', 'tomato sauce', 'ketchup', 'marinara', 'lycopene'],
    icon: '🍅',
  },
  {
    id: 'spicy_foods',
    label: 'Spicy Foods',
    keywords: ['chili', 'chilli', 'capsaicin', 'pepper', 'jalapeno', 'habanero', 'cayenne', 'hot sauce', 'sriracha', 'wasabi', 'horseradish'],
    icon: '🌶️',
  },
  {
    id: 'chocolate',
    label: 'Chocolate',
    keywords: ['chocolate', 'cocoa', 'cacao', 'cocoa butter', 'cocoa powder', 'dark chocolate', 'milk chocolate'],
    icon: '🍫',
  },
  {
    id: 'preservatives',
    label: 'Preservatives / Additives',
    keywords: [
      'preservative', 'bha', 'bht', 'sodium benzoate', 'potassium sorbate',
      'sulfite', 'sulfites', 'nitrate', 'nitrite', 'msg', 'monosodium glutamate',
      'aspartame', 'sucralose', 'artificial', 'food coloring', 'tartrazine',
      'carrageenan', 'sodium nitrite', 'sodium nitrate',
    ],
    icon: '🧪',
  },
  {
    id: 'histamine',
    label: 'Histamine-Rich Foods',
    keywords: ['fermented', 'aged cheese', 'wine', 'vinegar', 'sauerkraut', 'kimchi', 'smoked', 'cured'],
    icon: '⚗️',
  },
  {
    id: 'nightshades',
    label: 'Nightshades',
    keywords: ['nightshade', 'potato', 'eggplant', 'bell pepper', 'paprika', 'tomato', 'goji'],
    icon: '🍆',
  },
];

export function findFoodSensitivityMatches(
  ingredientsText: string,
  enabledTriggerIds: string[]
): { trigger: FoodSensitivityTrigger; matchedKeyword: string }[] {
  if (!ingredientsText || enabledTriggerIds.length === 0) return [];

  const normalizedText = ingredientsText.toLowerCase();
  const matches: { trigger: FoodSensitivityTrigger; matchedKeyword: string }[] = [];
  const found = new Set<string>();

  for (const trigger of FOOD_SENSITIVITY_TRIGGERS) {
    if (!enabledTriggerIds.includes(trigger.id)) continue;
    if (found.has(trigger.id)) continue;

    for (const keyword of trigger.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        found.add(trigger.id);
        matches.push({ trigger, matchedKeyword: keyword });
        break;
      }
    }
  }

  return matches;
}
