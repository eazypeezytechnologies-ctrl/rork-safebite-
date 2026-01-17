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
import { Check, X } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { EmergencyContact } from '@/types';

const COMMON_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts',
  'Wheat', 'Soybeans', 'Sesame', 'Mustard', 'Celery', 'Lupin',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profiles, updateProfile } = useProfiles();
  
  const profile = profiles.find(p => p.id === id);
  
  const [name, setName] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [customAllergen, setCustomAllergen] = useState('');
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [hasAnaphylaxis, setHasAnaphylaxis] = useState(false);
  const [medications, setMedications] = useState<string[]>([]);
  const [medication, setMedication] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setSelectedAllergens(profile.allergens);
      setCustomKeywords(profile.customKeywords);
      setHasAnaphylaxis(profile.hasAnaphylaxis);
      setMedications(profile.medications);
      setContacts(profile.emergencyContacts);
    }
  }, [profile]);

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens(prev =>
      prev.includes(allergen)
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
    );
  };

  const addCustomAllergen = () => {
    if (customAllergen.trim() && !selectedAllergens.includes(customAllergen.trim())) {
      setSelectedAllergens(prev => [...prev, customAllergen.trim()]);
      setCustomAllergen('');
    }
  };

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
      await updateProfile({
        ...profile,
        name: name.trim(),
        allergens: selectedAllergens,
        customKeywords,
        hasAnaphylaxis,
        medications,
        emergencyContacts: contacts,
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
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergens</Text>
          <View style={styles.allergenGrid}>
            {COMMON_ALLERGENS.map(allergen => (
              <TouchableOpacity
                key={allergen}
                style={[
                  styles.allergenButton,
                  selectedAllergens.includes(allergen) && styles.allergenButtonSelected,
                ]}
                onPress={() => toggleAllergen(allergen)}
              >
                <Text
                  style={[
                    styles.allergenButtonText,
                    selectedAllergens.includes(allergen) && styles.allergenButtonTextSelected,
                  ]}
                >
                  {allergen}
                </Text>
                {selectedAllergens.includes(allergen) && (
                  <Check size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customInput}>
            <TextInput
              style={styles.textInput}
              placeholder="Add custom allergen"
              value={customAllergen}
              onChangeText={setCustomAllergen}
              onSubmitEditing={addCustomAllergen}
            />
            <TouchableOpacity style={styles.addButton} onPress={addCustomAllergen}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {selectedAllergens.filter(a => !COMMON_ALLERGENS.includes(a)).length > 0 && (
            <View style={styles.customList}>
              {selectedAllergens
                .filter(a => !COMMON_ALLERGENS.includes(a))
                .map(allergen => (
                  <View key={allergen} style={styles.customItem}>
                    <Text style={styles.customItemText}>{allergen}</Text>
                    <TouchableOpacity
                      onPress={() => removeItem(selectedAllergens, setSelectedAllergens, allergen)}
                    >
                      <X size={20} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Keywords</Text>
          <View style={styles.customInput}>
            <TextInput
              style={styles.textInput}
              placeholder="Add keyword (e.g., casein, whey)"
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
                    <X size={20} color="#DC2626" />
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
              trackColor={{ false: '#D1D5DB', true: '#0891B2' }}
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
                        <X size={20} color="#DC2626" />
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
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  allergenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  allergenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  allergenButtonSelected: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  allergenButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  allergenButtonTextSelected: {
    color: '#FFFFFF',
  },
  customInput: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customItemText: {
    fontSize: 16,
    color: '#111827',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  medicationLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
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
    color: '#DC2626',
  },
});
