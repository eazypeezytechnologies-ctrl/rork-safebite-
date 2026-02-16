import { useState } from 'react';
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
import { useRouter, Href } from 'expo-router';
import { ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { Profile, EmergencyContact, ProfileRelationship } from '@/types';
import * as Crypto from 'expo-crypto';
import { PROFILE_RELATIONSHIPS, getRandomAvatarColor } from '@/constants/profileColors';
import { FOOD_SENSITIVITY_TRIGGERS } from '@/constants/sensitivityTriggers';
import { ECZEMA_TRIGGER_GROUPS } from '@/constants/eczemaTriggers';

const COMMON_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts',
  'Wheat', 'Soybeans', 'Sesame', 'Mustard', 'Celery', 'Lupin',
];

export default function ProfileWizard() {
  const router = useRouter();
  const { addProfile } = useProfiles();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<ProfileRelationship | undefined>(undefined);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [customAllergen, setCustomAllergen] = useState('');
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [hasAnaphylaxis, setHasAnaphylaxis] = useState(false);
  const [medications, setMedications] = useState<string[]>([]);
  const [medication, setMedication] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelationship, setContactRelationship] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackEczemaTriggers, setTrackEczemaTriggers] = useState(false);
  const [eczemaTriggerGroups, setEczemaTriggerGroups] = useState<string[]>([]);

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

  const addContact = () => {
    if (contactName.trim() && contactPhone.trim()) {
      setContacts(prev => [
        ...prev,
        {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relationship: contactRelationship.trim() || 'Emergency Contact',
        },
      ]);
      setContactName('');
      setContactPhone('');
      setContactRelationship('');
    }
  };

  const removeItem = (list: string[], setList: (items: string[]) => void, item: string) => {
    setList(list.filter(i => i !== item));
  };

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const toggleTriggerGroup = (groupId: string) => {
    setEczemaTriggerGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return true;
      case 3:
        return selectedAllergens.length > 0;
      case 4:
      case 5:
      case 6:
      case 7:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step < 7) {
      setStep(step + 1);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const profile: Profile = {
        id: Crypto.randomUUID(),
        name: name.trim(),
        relationship,
        allergens: selectedAllergens,
        customKeywords,
        hasAnaphylaxis,
        emergencyContacts: contacts,
        medications,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        avatarColor: getRandomAvatarColor(),
        trackEczemaTriggers,
        eczemaTriggerGroups: trackEczemaTriggers ? eczemaTriggerGroups : [],
      };

      if (__DEV__) console.log('[Wizard] Creating profile:', profile.name);
      
      await addProfile(profile);
      
      if (__DEV__) console.log('[Wizard] Profile created, navigating to home screen');
      router.replace('/(tabs)/(scan)' as Href);
    } catch (error) {
      console.error('[Wizard] Error creating profile:', error);
      setIsSubmitting(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';
      Alert.alert('Error', errorMessage + '. Please try again.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Who is this profile for?</Text>
            <Text style={styles.stepSubtitle}>Enter a name to identify this profile</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Emma, Dad, Me"
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Relationship</Text>
            <Text style={styles.stepSubtitle}>How is this person related to you?</Text>
            <View style={styles.relationshipGrid}>
              {PROFILE_RELATIONSHIPS.map(rel => (
                <TouchableOpacity
                  key={rel.value}
                  style={[
                    styles.relationshipButton,
                    relationship === rel.value && styles.relationshipButtonSelected,
                  ]}
                  onPress={() => setRelationship(rel.value)}
                >
                  <Text style={styles.relationshipIcon}>{rel.icon}</Text>
                  <Text
                    style={[
                      styles.relationshipButtonText,
                      relationship === rel.value && styles.relationshipButtonTextSelected,
                    ]}
                  >
                    {rel.label}
                  </Text>
                  {relationship === rel.value && (
                    <Check size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
              <Text style={styles.skipButtonText}>Skip this step</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select allergens</Text>
            <Text style={styles.stepSubtitle}>Choose all that apply</Text>
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
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            )}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Custom keywords</Text>
            <Text style={styles.stepSubtitle}>
              Add specific ingredients to watch for (e.g., casein, whey, tahini)
            </Text>
            <View style={styles.customInput}>
              <TextInput
                style={styles.textInput}
                placeholder="Add keyword"
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
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
              <Text style={styles.skipButtonText}>Skip this step</Text>
            </TouchableOpacity>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Anaphylaxis risk</Text>
            <Text style={styles.stepSubtitle}>
              Does this person have a history of severe allergic reactions?
            </Text>
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
                <Text style={styles.medicationLabel}>Medications (e.g., EpiPen)</Text>
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
                          <Text style={styles.removeText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Skin Sensitivity (Eczema Triggers)</Text>
            <Text style={styles.stepSubtitle}>
              Track ingredients that may trigger eczema flare-ups, dermatitis, or skin reactions.
            </Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Track skin sensitivity (eczema flare triggers)</Text>
              <Switch
                value={trackEczemaTriggers}
                onValueChange={setTrackEczemaTriggers}
                trackColor={{ false: '#D1D5DB', true: '#D97706' }}
                thumbColor="#FFFFFF"
              />
            </View>
            {trackEczemaTriggers && (
              <View style={styles.sensitivityHelperBox}>
                <Text style={styles.sensitivityHelperText}>
                  These are sensitivity triggers (not allergies). We&apos;ll warn you if ingredients may cause flare-ups.
                </Text>
              </View>
            )}
            {trackEczemaTriggers && (
              <>
                <Text style={styles.triggerLabel}>Food-based triggers to watch for:</Text>
                <View style={styles.triggerGrid}>
                  {FOOD_SENSITIVITY_TRIGGERS.map(trigger => {
                    const isSelected = eczemaTriggerGroups.includes(trigger.id);
                    return (
                      <TouchableOpacity
                        key={trigger.id}
                        style={[
                          styles.triggerChip,
                          isSelected && styles.triggerChipSelected,
                        ]}
                        onPress={() => toggleTriggerGroup(trigger.id)}
                      >
                        <Text style={styles.triggerIcon}>{trigger.icon}</Text>
                        <Text
                          style={[
                            styles.triggerChipText,
                            isSelected && styles.triggerChipTextSelected,
                          ]}
                        >
                          {trigger.label}
                        </Text>
                        {isSelected && <Check size={14} color="#FFFFFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.triggerLabel}>Skincare irritants:</Text>
                <View style={styles.triggerGrid}>
                  {ECZEMA_TRIGGER_GROUPS.map(group => {
                    const isSelected = eczemaTriggerGroups.includes(group.id);
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={[
                          styles.triggerChip,
                          isSelected && styles.triggerChipSelected,
                        ]}
                        onPress={() => toggleTriggerGroup(group.id)}
                      >
                        <Text style={styles.triggerIcon}>{group.icon}</Text>
                        <Text
                          style={[
                            styles.triggerChipText,
                            isSelected && styles.triggerChipTextSelected,
                          ]}
                        >
                          {group.label}
                        </Text>
                        {isSelected && <Check size={14} color="#FFFFFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.sensitivityDisclaimer}>
                  <AlertTriangle size={14} color="#92400E" />
                  <Text style={styles.disclaimerText}>
                    Triggers vary by person. Not medical advice.
                  </Text>
                </View>
              </>
            )}
            <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
              <Text style={styles.skipButtonText}>Skip this step</Text>
            </TouchableOpacity>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Emergency contacts</Text>
            <Text style={styles.stepSubtitle}>Add people to contact in case of emergency</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Name"
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Phone number"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.textInput}
              placeholder="Relationship (optional)"
              value={contactRelationship}
              onChangeText={setContactRelationship}
            />
            <TouchableOpacity style={styles.addButton} onPress={addContact}>
              <Text style={styles.addButtonText}>Add Contact</Text>
            </TouchableOpacity>
            {contacts.length > 0 && (
              <View style={styles.customList}>
                {contacts.map((contact, index) => (
                  <View key={index} style={styles.contactItem}>
                    <View>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                      <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeContact(index)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
              <Text style={styles.skipButtonText}>Skip this step</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              router.replace('/welcome' as Href);
            }
          }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4, 5, 6, 7].map(s => (
            <View
              key={s}
              style={[styles.progressDot, s <= step && styles.progressDotActive]}
            />
          ))}
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!canProceed() || isSubmitting) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed() || isSubmitting}
        >
          <Text style={styles.nextButtonText}>
            {isSubmitting ? 'Creating...' : step === 7 ? 'Finish' : 'Next'}
          </Text>
          {step < 7 && !isSubmitting && <ChevronRight size={20} color="#FFFFFF" />}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#0891B2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
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
    marginBottom: 24,
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
    marginBottom: 16,
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
  removeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  triggerLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
    marginBottom: 10,
    marginTop: 4,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  triggerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  triggerChipSelected: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  triggerIcon: {
    fontSize: 16,
  },
  triggerChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
  },
  triggerChipTextSelected: {
    color: '#FFFFFF',
  },
  sensitivityDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },
  sensitivityHelperBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sensitivityHelperText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  contactRelationship: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  relationshipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minWidth: 120,
  },
  relationshipButtonSelected: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  relationshipIcon: {
    fontSize: 20,
  },
  relationshipButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  relationshipButtonTextSelected: {
    color: '#FFFFFF',
  },
});
