import { Profile, ProfileHealthItem, HealthItemStatus, HealthItemCategory, SuggestedProfileChange } from '@/types';

export interface ResolvedSkipInfo {
  name: string;
  category: HealthItemCategory;
  resolvedAt?: string;
}

let _lastSkippedResolved: ResolvedSkipInfo[] = [];

export function getLastSkippedResolved(): ResolvedSkipInfo[] {
  return _lastSkippedResolved;
}

export function clearSkippedResolved(): void {
  _lastSkippedResolved = [];
}

export function getActiveAllergens(profile: Profile): string[] {
  const healthItems = profile.healthItems ?? [];
  const allergenItems = healthItems.filter(
    h => h.category === 'allergy' && (h.status === 'confirmed' || h.status === 'suspected'),
  );

  if (allergenItems.length === 0) {
    return profile.allergens;
  }

  const resolvedItems = healthItems.filter(h => h.category === 'allergy' && h.status === 'resolved');
  const resolvedNames = new Set(resolvedItems.map(h => h.name));

  const result = profile.allergens.filter(a => {
    if (resolvedNames.has(a)) {
      const item = resolvedItems.find(h => h.name === a);
      console.log(`[ProfileHealth] Skipping resolved allergen: ${a}`);
      _lastSkippedResolved.push({
        name: a,
        category: 'allergy',
        resolvedAt: item?.lastReviewedAt,
      });
      return false;
    }
    return true;
  });

  for (const item of allergenItems) {
    if (!result.includes(item.name)) {
      result.push(item.name);
    }
  }

  return result;
}

export function getActiveEczemaTriggerGroups(profile: Profile): string[] {
  const healthItems = profile.healthItems ?? [];
  const eczemaItems = healthItems.filter(
    h => h.category === 'eczema_trigger' && (h.status === 'confirmed' || h.status === 'suspected'),
  );

  if (eczemaItems.length === 0) {
    return profile.eczemaTriggerGroups ?? [];
  }

  const resolvedItems = healthItems.filter(h => h.category === 'eczema_trigger' && h.status === 'resolved');
  const resolvedNames = new Set(resolvedItems.map(h => h.name));

  const groups = (profile.eczemaTriggerGroups ?? []).filter(g => {
    if (resolvedNames.has(g)) {
      const item = resolvedItems.find(h => h.name === g);
      console.log(`[ProfileHealth] Skipping resolved eczema trigger: ${g}`);
      _lastSkippedResolved.push({
        name: g,
        category: 'eczema_trigger',
        resolvedAt: item?.lastReviewedAt,
      });
      return false;
    }
    return true;
  });

  for (const item of eczemaItems) {
    if (!groups.includes(item.name)) {
      groups.push(item.name);
    }
  }

  return groups;
}

export function getActiveSensitivities(profile: Profile): string[] {
  const healthItems = profile.healthItems ?? [];
  const sensitivityItems = healthItems.filter(
    h => h.category === 'sensitivity' && (h.status === 'confirmed' || h.status === 'suspected'),
  );

  if (sensitivityItems.length === 0) {
    return profile.avoidIngredients ?? [];
  }

  const resolvedItems = healthItems.filter(h => h.category === 'sensitivity' && h.status === 'resolved');
  const resolvedNames = new Set(resolvedItems.map(h => h.name));

  const result = (profile.avoidIngredients ?? []).filter(i => {
    if (resolvedNames.has(i)) {
      const item = resolvedItems.find(h => h.name === i);
      console.log(`[ProfileHealth] Skipping resolved sensitivity: ${i}`);
      _lastSkippedResolved.push({
        name: i,
        category: 'sensitivity',
        resolvedAt: item?.lastReviewedAt,
      });
      return false;
    }
    return true;
  });

  for (const item of sensitivityItems) {
    if (!result.includes(item.name)) {
      result.push(item.name);
    }
  }

  return result;
}

export function isItemResolved(profile: Profile, itemName: string): boolean {
  return (profile.healthItems ?? []).some(
    h => h.name === itemName && h.status === 'resolved',
  );
}

export function getHealthItemForName(profile: Profile, itemName: string): ProfileHealthItem | undefined {
  return (profile.healthItems ?? []).find(h => h.name === itemName);
}

export function upsertHealthItem(
  existingItems: ProfileHealthItem[],
  name: string,
  category: HealthItemCategory,
  status: HealthItemStatus,
  severity: 'mild' | 'moderate' | 'severe' = 'moderate',
  notes?: string,
): ProfileHealthItem[] {
  const items = [...existingItems];
  const idx = items.findIndex(h => h.name === name && h.category === category);
  const now = new Date().toISOString();

  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      status,
      severity,
      lastReviewedAt: now,
      notes: notes ?? items[idx].notes,
    };
  } else {
    items.push({
      name,
      category,
      status,
      severity,
      lastReviewedAt: now,
      notes,
    });
  }

  console.log(`[ProfileHealth] Upserted health item: ${name} (${category}) -> ${status}/${severity}`);
  return items;
}

export function resolveHealthItem(
  existingItems: ProfileHealthItem[],
  name: string,
  category: HealthItemCategory,
  notes?: string,
): ProfileHealthItem[] {
  return upsertHealthItem(existingItems, name, category, 'resolved', 'mild', notes ?? 'Resolved/outgrown');
}

export function confirmHealthItem(
  existingItems: ProfileHealthItem[],
  name: string,
  category: HealthItemCategory,
  severity: 'mild' | 'moderate' | 'severe' = 'moderate',
): ProfileHealthItem[] {
  return upsertHealthItem(existingItems, name, category, 'confirmed', severity);
}

export function applySuggestedChange(
  profile: Profile,
  change: SuggestedProfileChange,
): ProfileHealthItem[] {
  const items = [...(profile.healthItems ?? [])];

  if (change.action === 'resolve') {
    return resolveHealthItem(items, change.itemName, change.category);
  }

  if (change.action === 'add') {
    return upsertHealthItem(
      items,
      change.itemName,
      change.category,
      change.newStatus ?? 'suspected',
      change.newSeverity ?? 'moderate',
      change.reason,
    );
  }

  if (change.action === 'update_severity') {
    const existing = items.find(h => h.name === change.itemName && h.category === change.category);
    if (existing) {
      return upsertHealthItem(
        items,
        change.itemName,
        change.category,
        change.newStatus ?? existing.status,
        change.newSeverity ?? existing.severity,
        change.reason,
      );
    }
  }

  return items;
}

export function buildHealthItemsFromProfile(profile: Profile): ProfileHealthItem[] {
  const items: ProfileHealthItem[] = [...(profile.healthItems ?? [])];
  const existingNames = new Set(items.map(h => `${h.category}:${h.name}`));
  const now = new Date().toISOString();

  for (const allergen of profile.allergens) {
    const key = `allergy:${allergen}`;
    if (!existingNames.has(key)) {
      items.push({
        name: allergen,
        category: 'allergy',
        status: 'confirmed',
        severity: 'moderate',
        lastReviewedAt: now,
      });
      existingNames.add(key);
    }
  }

  for (const group of profile.eczemaTriggerGroups ?? []) {
    const key = `eczema_trigger:${group}`;
    if (!existingNames.has(key)) {
      items.push({
        name: group,
        category: 'eczema_trigger',
        status: 'confirmed',
        severity: 'moderate',
        lastReviewedAt: now,
      });
      existingNames.add(key);
    }
  }

  for (const avoid of profile.avoidIngredients ?? []) {
    const key = `sensitivity:${avoid}`;
    if (!existingNames.has(key)) {
      items.push({
        name: avoid,
        category: 'sensitivity',
        status: 'confirmed',
        severity: 'mild',
        lastReviewedAt: now,
      });
      existingNames.add(key);
    }
  }

  return items;
}

export function getHealthItemSummary(profile: Profile): {
  activeAllergens: number;
  resolvedAllergens: number;
  activeEczema: number;
  resolvedEczema: number;
  activeSensitivities: number;
  resolvedSensitivities: number;
} {
  const items = profile.healthItems ?? [];
  return {
    activeAllergens: items.filter(h => h.category === 'allergy' && h.status !== 'resolved').length,
    resolvedAllergens: items.filter(h => h.category === 'allergy' && h.status === 'resolved').length,
    activeEczema: items.filter(h => h.category === 'eczema_trigger' && h.status !== 'resolved').length,
    resolvedEczema: items.filter(h => h.category === 'eczema_trigger' && h.status === 'resolved').length,
    activeSensitivities: items.filter(h => h.category === 'sensitivity' && h.status !== 'resolved').length,
    resolvedSensitivities: items.filter(h => h.category === 'sensitivity' && h.status === 'resolved').length,
  };
}
