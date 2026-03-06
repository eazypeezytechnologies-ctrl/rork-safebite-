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
import { ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { Profile, EmergencyContact, ProfileRelationship, ProfileDocument } from '@/types';
import * as Crypto from 'expo-crypto';
import { PROFILE_RELATIONSHIPS, getRandomAvatarColor } from '@/constants/profileColors';
import { RestrictionsSetup } from '@/components/RestrictionsSetup';
import { DietaryRestrictionsSetup } from '@/components/DietaryRestrictionsSetup';
import { arcaneColors, arcaneRadius } from '@/constants/theme';


const TOTAL_STEPS = 7;

export default function ProfileWizard() {
  const router = useRouter();
  const { addProfile } = useProfiles();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<ProfileRelationship | undefined>(undefined);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
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
  const [dietaryRules, setDietaryRules] = useState<string[]>([]);
  const [avoidIngredients, setAvoidIngredients] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<Record<string, boolean>>({});
  const [dietaryStrictness, setDietaryStrictness] = useState<Record<string, 'relaxed' | 'standard' | 'strict'>>({});
  const [profileDocuments, setProfileDocuments] = useState<ProfileDocument[]>([]);

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
    if (step < TOTAL_STEPS) {
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
        dietaryRules,
        avoidIngredients,
        dietaryRestrictions,
        dietaryStrictness,
        profileDocuments,
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
              placeholderTextColor={arcaneColors.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
              testID="wizard-name-input"
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
            <Text style={styles.stepTitle}>Restrictions</Text>
            <Text style={styles.stepSubtitle}>
              Set up allergies, sensitivities, and dietary rules — no typing needed
            </Text>
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
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Dietary Restrictions</Text>
            <Text style={styles.stepSubtitle}>
              Set dietary rules with strictness levels (optional)
            </Text>
            <DietaryRestrictionsSetup
              dietaryRestrictions={dietaryRestrictions}
              onDietaryRestrictionsChange={setDietaryRestrictions}
              dietaryStrictness={dietaryStrictness}
              onDietaryStrictnessChange={setDietaryStrictness}
            />
            <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
              <Text style={styles.skipButtonText}>Skip this step</Text>
            </TouchableOpacity>
          </View>
        );

      case 5:
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

      case 6:
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
                trackColor={{ false: '#D1D5DB', true: arcaneColors.primary }}
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

      case 7:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Emergency contacts</Text>
            <Text style={styles.stepSubtitle}>Add people to contact in case of emergency</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Name"
              placeholderTextColor={arcaneColors.textMuted}
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Phone number"
              placeholderTextColor={arcaneColors.textMuted}
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.textInput}
              placeholder="Relationship (optional)"
              placeholderTextColor={arcaneColors.textMuted}
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
                      <Text style={styles.contactRelationshipText}>{contact.relationship}</Text>
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

  const stepLabels = ['Name', 'Role', 'Restrictions', 'Dietary', 'Keywords', 'Risk', 'Contacts'];

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
          <ChevronLeft size={24} color={arcaneColors.text} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
            <View
              key={s}
              style={[
                styles.progressDot,
                s <= step && styles.progressDotActive,
                s === step && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>
        <View style={styles.backButton} />
      </View>

      <View style={styles.stepIndicator}>
        <Text style={styles.stepIndicatorText}>
          Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!canProceed() || isSubmitting) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed() || isSubmitting}
          testID="wizard-next-button"
        >
          <Text style={styles.nextButtonText}>
            {isSubmitting ? 'Creating...' : step === TOTAL_STEPS ? 'Finish' : 'Next'}
          </Text>
          {step < TOTAL_STEPS && !isSubmitting && <ChevronRight size={20} color="#FFFFFF" />}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: arcaneColors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: arcaneColors.border,
  },
  progressDotActive: {
    backgroundColor: arcaneColors.primaryLight,
  },
  progressDotCurrent: {
    backgroundColor: arcaneColors.primary,
    width: 20,
    borderRadius: 4,
  },
  stepIndicator: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: arcaneColors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.borderLight,
  },
  stepIndicatorText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  stepSubtitle: {
    fontSize: 15,
    color: arcaneColors.textSecondary,
    marginBottom: 20,
    lineHeight: 21,
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
    marginBottom: 16,
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
  removeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.danger,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  medicationLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: arcaneColors.textSecondary,
    marginBottom: 2,
  },
  contactRelationshipText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: arcaneColors.textSecondary,
  },
  footer: {
    padding: 16,
    backgroundColor: arcaneColors.bgCard,
    borderTopWidth: 1,
    borderTopColor: arcaneColors.border,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
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
    borderRadius: arcaneRadius.lg,
    backgroundColor: arcaneColors.bgCard,
    borderWidth: 2,
    borderColor: arcaneColors.border,
    minWidth: 120,
  },
  relationshipButtonSelected: {
    backgroundColor: arcaneColors.primary,
    borderColor: arcaneColors.primary,
  },
  relationshipIcon: {
    fontSize: 20,
  },
  relationshipButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  relationshipButtonTextSelected: {
    color: '#FFFFFF',
  },
});
