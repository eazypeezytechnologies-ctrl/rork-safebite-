export type VerdictLevel = 'safe' | 'caution' | 'danger';

export interface AllergenMatch {
  allergen: string;
  source: 'allergens_tags' | 'traces_tags' | 'ingredients' | 'custom_keyword';
  matchedText?: string;
}

export interface EczemaTriggerMatch {
  triggerName: string;
  triggerGroup: string;
  matchedText: string;
  severityHint: 'low' | 'medium' | 'high';
}

export interface Verdict {
  level: VerdictLevel;
  matches: AllergenMatch[];
  eczemaTriggers?: EczemaTriggerMatch[];
  message: string;
  missingData?: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export type ProfileRelationship = 'self' | 'spouse' | 'partner' | 'child' | 'son' | 'daughter' | 'parent' | 'mother' | 'father' | 'grandparent' | 'grandmother' | 'grandfather' | 'sibling' | 'other';

export interface Profile {
  id: string;
  name: string;
  relationship?: ProfileRelationship;
  dateOfBirth?: string;
  allergens: string[];
  customKeywords: string[];
  hasAnaphylaxis: boolean;
  emergencyContacts: EmergencyContact[];
  medications: string[];
  createdAt: string;
  updatedAt: string;
  isAdmin?: boolean;
  avatarColor?: string;
  trackEczemaTriggers?: boolean;
  eczemaTriggerGroups?: string[];
}

export interface User {
  id: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Product {
  code: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  ingredients_text?: string;
  allergens?: string;
  allergens_tags?: string[];
  traces?: string;
  traces_tags?: string[];
  categories?: string;
  categories_tags?: string[];
  source: 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts' | 'upcdatabase' | 'upcitemdb' | 'barcodelookup' | 'worldupc' | 'eansearch' | 'datakick' | 'usda' | 'nutritionix' | 'edamam' | 'manual_entry';
}

export interface ProductSearchResult {
  products: Product[];
  count: number;
  page: number;
  page_size: number;
}

export interface RecallResult {
  recall_number: string;
  reason_for_recall: string;
  product_description: string;
  recall_initiation_date: string;
  status: string;
  distribution_pattern?: string;
  product_quantity?: string;
  voluntary_mandated?: string;
  classification?: string;
  openfda?: {
    brand_name?: string[];
    product_type?: string[];
  };
}

export interface RecallSearchResponse {
  results: RecallResult[];
  meta: {
    results: {
      total: number;
    };
  };
}

export interface ScanResult {
  product: Product | null;
  verdict: Verdict | null;
  error?: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'individual' | 'family';

export type SubscriptionPlan = 'free' | 'individual' | 'family';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired';

export interface UserSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyInvitation {
  id: string;
  familyGroupId: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  createdAt: string;
}
