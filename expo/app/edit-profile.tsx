import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { EmergencyContact, ProfileDocument, ProfileHealthItem } from '@/types';
import { RestrictionsSetup } from '@/components/RestrictionsSetup';
import { DietaryRestrictionsSetup } from '@/components/DietaryRestrictionsSetup';
import { HealthItemManager } from '@/components/HealthItemManager';
import { buildHealthItemsFromProfile, upsertHealthItem } from '@/utils/profileHealthItems';
import { ProfileHealthItem as PHI, HealthItemCategory } from '@/types';
import { arcaneColors, arcaneRadius } from '@/constants/theme';

function syncHealthItemsWithSelections(
  currentItems: PHI[],
  allergens: string[],
  eczemaGroups: string[],
  avoidIngredients: string[],
): PHI[] {
  let items = [...currentItems];
  const now = new Date().toISOString();

  const ensureItem = (name: string, category: HealthItemCategory) => {
    const existing = items.find(h => h.name === name && h.category === category);
    if (!existing) {
      items = upsertHealthItem(items, name, category, 'confirmed', 'moderate');
    } else if (existing.status === 'resolved') {
      // don't auto-reactivate resolved items
    }
  };

  for (const a of allergens) ensureItem(a, 'allergy');
  for (const g of eczemaGroups) ensureItem(g, 'eczema_trigger');
  for (const i of avoidIngredients) ensureItem(i, 'sensitivity');

  return items;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profiles, updateProfile } = useProfiles();
  
  const profile = profiles.find(p => p.id === id);
  
  const [name, setName] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [hasAnaphylaxis, setHasAnaphylaxis] = useState(false);
  const [medications, setMedications] = useState<string[]>([]);
  const [medication, setMedication] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [trackEczemaTriggers, setTrackEczemaTriggers] = useState(false);
  const [eczemaTriggerGroups, setEczemaTriggerGroups] = useState<string[]>([]);
  const [dietaryRules, setDietaryRules] = useState<string[]>([]);
  const [avoidIngredients, setAvoidIngredients] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<Record<string, boolean>>({});
  const [dietaryStrictness, setDietaryStrictness] = useState<Record<string, 'relaxed' | 'standard' | 'strict'>>({});
  const [profileDocuments, setProfileDocuments] = useState<ProfileDocument[]>([]);
  const [healthItems, setHealthItems] = useState<ProfileHealthItem[]>([]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setSelectedAllergens(profile.allergens);
      setCustomKeywords(profile.customKeywords);
      setHasAnaphylaxis(profile.hasAnaphylaxis);
      setMedications(profile.medications);
      setContacts(profile.emergencyContacts);
      setTrackEczemaTriggers(profile.trackEczemaTriggers || false);
      setEczemaTriggerGroups(profile.eczemaTriggerGroups || []);
      setDietaryRules(profile.dietaryRules || []);
      setAvoidIngredients(profile.avoidIngredients || []);
      setDietaryRestrictions(profile.dietaryRestrictions || {});
      setDietaryStrictness(profile.dietaryStrictness || {});
      setProfileDocuments(profile.profileDocuments || []);
      const items = (profile.healthItems && profile.healthItems.length > 0)
        ? profile.healthItems
        : buildHealthItemsFromProfile(profile);
      setHealthItems(items);
    }
  }, [profile]);

  const addCustomKeywordItem = () => {
    if (customKeyword.trim() && !customKeywords.includes(customKeyword.trim())) {
      setCustomKeywords(prev => [...prev, customKeyword.trim()]);
      setCustomKeyword('');
    }
  };

  const addMedication = () => {
    if (medication.trim() && !medications.includes(medication.trim())) {
      setMedications(prev => [...prev, medication.trim()]);
      setMedication('');
    }
  };

  const removeItem = (list: string[], setList: (items: string[]) => void, item: string) => {
    setList(list.filter(i => i !== item));
  };

  const handleSave = async () => {
    if (!profile) return;
    
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    
    if (selectedAllergens.length === 0) {
      Alert.alert('Error', 'Please select at least one allergen');
      return;
    }

    try {
      const syncedHealthItems = syncHealthItemsWithSelections(
        healthItems,
        selectedAllergens,
        trackEczemaTriggers ? eczemaTriggerGroups : [],
        avoidIngredients,
      );

      await updateProfile({
        ...profile,
        name: name.trim(),
        allergens: selectedAllergens,
        customKeywords,
        hasAnaphylaxis,
        medications,
        emergencyContacts: contacts,
        trackEczemaTriggers,
        eczemaTriggerGroups: trackEczemaTriggers ? eczemaTriggerGroups : [],
        dietaryRules,
        avoidIngredients,
        dietaryRestrictions,
        dietaryStrictness,
        profileDocuments,
        healthItems: syncedHealthItems,
        updatedAt: new Date().toISOString(),
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Profile name"
            placeholderTextColor={arcaneColors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restrictions</Text>
          <Text style={styles.sectionSubtitle}>Allergies, sensitivities & dietary rules</Text>
          <RestrictionsSetup
            selectedAllergens={selectedAllergens}
            onAllergensChange={setSelectedAllergens}
            trackEczemaTriggers={trackEczemaTriggers}
            onTrackEczemaTriggersChange={setTrackEczemaTriggers}
            eczemaTriggerGroups={eczemaTriggerGroups}
            onEczemaTriggerGroupsChange={setEczemaTriggerGroups}
            dietaryRules={dietaryRules}
            onDietaryRulesChange={setDietaryRules}
            avoidIngredients={avoidIngredients}
            onAvoidIngredientsChange={setAvoidIngredients}
            documents={profileDocuments}
            onDocumentsChange={setProfileDocuments}
            showUploadRecords
          />
        </View>

        {healthItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Timeline</Text>
            <Text style={styles.sectionSubtitle}>Track status changes over time — mark items as resolved when outgrown</Text>
            <HealthItemManager
              healthItems={healthItems}
              onHealthItemsChange={setHealthItems}
              category="allergy"
              title="Allergies"
            />
            <HealthItemManager
              healthItems={healthItems}
              onHealthItemsChange={setHealthItems}
              category="eczema_trigger"
              title="Eczema Triggers"
            />
            <HealthItemManager
              healthItems={healthItems}
              onHealthItemsChange={setHealthItems}
              category="sensitivity"
              title="Sensitivities"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
          <Text style={styles.sectionSubtitle}>Strictness-based dietary rules for food & cosmetics</Text>
          <DietaryRestrictionsSetup
            dietaryRestrictions={dietaryRestrictions}
            onDietaryRestrictionsChange={setDietaryRestrictions}
            dietaryStrictness={dietaryStrictness}
            onDietaryStrictnessChange={setDietaryStrictness}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Keywords</Text>
          <View style={styles.customInput}>
            <TextInput
              style={styles.textInput}
              placeholder="Add keyword (e.g., casein, whey)"
              placeholderTextColor={arcaneColors.textMuted}
              value={customKeyword}
              onChangeText={setCustomKeyword}
              onSubmitEditing={addCustomKeywordItem}
            />
            <TouchableOpacity style={styles.addButton} onPress={addCustomKeywordItem}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {customKeywords.length > 0 && (
            <View style={styles.customList}>
              {customKeywords.map(keyword => (
                <View key={keyword} style={styles.customItem}>
                  <Text style={styles.customItemText}>{keyword}</Text>
                  <TouchableOpacity
                    onPress={() => removeItem(customKeywords, setCustomKeywords, keyword)}
                  >
                    <X size={20} color={arcaneColors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anaphylaxis Risk</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Risk of anaphylaxis</Text>
            <Switch
              value={hasAnaphylaxis}
              onValueChange={setHasAnaphylaxis}
              trackColor={{ false: '#D1D5DB', true: arcaneColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          {hasAnaphylaxis && (
            <>
              <Text style={styles.medicationLabel}>Medications</Text>
              <View style={styles.customInput}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Add medication"
                  placeholderTextColor={arcaneColors.textMuted}
                  value={medication}
                  onChangeText={setMedication}
                  onSubmitEditing={addMedication}
                />
                <TouchableOpacity style={styles.addButton} onPress={addMedication}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {medications.length > 0 && (
                <View style={styles.customList}>
                  {medications.map(med => (
                    <View key={med} style={styles.customItem}>
                      <Text style={styles.customItemText}>{med}</Text>
                      <TouchableOpacity
                        onPress={() => removeItem(medications, setMedications, med)}
                      >
                        <X size={20} color={arcaneColors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: arcaneColors.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: arcaneColors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: arcaneColors.textSecondary,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    marginBottom: 12,
    color: arcaneColors.text,
  },
  customInput: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  customList: {
    gap: 8,
  },
  customItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  customItemText: {
    fontSize: 16,
    color: arcaneColors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    flex: 1,
    marginRight: 12,
  },
  medicationLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    marginBottom: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: arcaneColors.bgCard,
    borderTopWidth: 1,
    borderTopColor: arcaneColors.border,
  },
  saveButton: {
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: arcaneColors.danger,
  },
});
