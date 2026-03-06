import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { Check, X, Plus, ShieldAlert, Leaf, Droplets, Upload, FileText, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { TOP_ALLERGENS, DIETARY_RULES, COMMON_AVOID_INGREDIENTS } from '@/constants/restrictions';
import { FOOD_SENSITIVITY_TRIGGERS } from '@/constants/sensitivityTriggers';
import { ECZEMA_TRIGGER_GROUPS } from '@/constants/eczemaTriggers';
import { ProfileDocument } from '@/types';

interface RestrictionsSetupProps {
  selectedAllergens: string[];
  onAllergensChange: (allergens: string[]) => void;
  trackEczemaTriggers: boolean;
  onTrackEczemaTriggersChange: (value: boolean) => void;
  eczemaTriggerGroups: string[];
  onEczemaTriggerGroupsChange: (groups: string[]) => void;
  dietaryRules: string[];
  onDietaryRulesChange: (rules: string[]) => void;
  avoidIngredients: string[];
  onAvoidIngredientsChange: (ingredients: string[]) => void;
  documents?: ProfileDocument[];
  onDocumentsChange?: (docs: ProfileDocument[]) => void;
  showUploadRecords?: boolean;
}

export const RestrictionsSetup = React.memo(function RestrictionsSetup({
  selectedAllergens,
  onAllergensChange,
  trackEczemaTriggers,
  onTrackEczemaTriggersChange,
  eczemaTriggerGroups,
  onEczemaTriggerGroupsChange,
  dietaryRules,
  onDietaryRulesChange,
  avoidIngredients,
  onAvoidIngredientsChange,
  documents = [],
  onDocumentsChange,
  showUploadRecords = false,
}: RestrictionsSetupProps) {
  const [customAllergen, setCustomAllergen] = useState('');
  const [customAvoidIngredient, setCustomAvoidIngredient] = useState('');

  const hapticFeedback = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const toggleAllergen = useCallback((label: string) => {
    hapticFeedback();
    if (selectedAllergens.includes(label)) {
      onAllergensChange(selectedAllergens.filter(a => a !== label));
    } else {
      onAllergensChange([...selectedAllergens, label]);
    }
  }, [selectedAllergens, onAllergensChange, hapticFeedback]);

  const addCustomAllergen = useCallback(() => {
    const trimmed = customAllergen.trim();
    if (trimmed && !selectedAllergens.includes(trimmed)) {
      hapticFeedback();
      onAllergensChange([...selectedAllergens, trimmed]);
      setCustomAllergen('');
    }
  }, [customAllergen, selectedAllergens, onAllergensChange, hapticFeedback]);

  const toggleTriggerGroup = useCallback((groupId: string) => {
    hapticFeedback();
    if (eczemaTriggerGroups.includes(groupId)) {
      onEczemaTriggerGroupsChange(eczemaTriggerGroups.filter(g => g !== groupId));
    } else {
      onEczemaTriggerGroupsChange([...eczemaTriggerGroups, groupId]);
    }
  }, [eczemaTriggerGroups, onEczemaTriggerGroupsChange, hapticFeedback]);

  const toggleDietaryRule = useCallback((ruleId: string) => {
    hapticFeedback();
    if (dietaryRules.includes(ruleId)) {
      onDietaryRulesChange(dietaryRules.filter(r => r !== ruleId));
    } else {
      onDietaryRulesChange([...dietaryRules, ruleId]);
    }
  }, [dietaryRules, onDietaryRulesChange, hapticFeedback]);

  const toggleAvoidIngredient = useCallback((label: string) => {
    hapticFeedback();
    if (avoidIngredients.includes(label)) {
      onAvoidIngredientsChange(avoidIngredients.filter(i => i !== label));
    } else {
      onAvoidIngredientsChange([...avoidIngredients, label]);
    }
  }, [avoidIngredients, onAvoidIngredientsChange, hapticFeedback]);

  const addCustomAvoidIngredient = useCallback(() => {
    const trimmed = customAvoidIngredient.trim();
    if (trimmed && !avoidIngredients.includes(trimmed)) {
      hapticFeedback();
      onAvoidIngredientsChange([...avoidIngredients, trimmed]);
      setCustomAvoidIngredient('');
    }
  }, [customAvoidIngredient, avoidIngredients, onAvoidIngredientsChange, hapticFeedback]);

  const knownAllergenLabels = TOP_ALLERGENS.map(a => a.label);
  const customAllergens = selectedAllergens.filter(a => !knownAllergenLabels.includes(a));
  const knownAvoidLabels = COMMON_AVOID_INGREDIENTS.map(i => i.label);
  const customAvoids = avoidIngredients.filter(i => !knownAvoidLabels.includes(i));

  const handleUploadRecord = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newDoc: ProfileDocument = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          profileId: '',
          fileName: asset.fileName || `Record_${new Date().toLocaleDateString()}`,
          fileType: asset.mimeType || 'image/jpeg',
          fileUri: asset.uri,
          uploadedAt: new Date().toISOString(),
        };
        onDocumentsChange?.([...documents, newDoc]);
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('[RestrictionsSetup] Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  }, [documents, onDocumentsChange]);

  const handleDeleteDocument = useCallback((docId: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to remove this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDocumentsChange?.(documents.filter(d => d.id !== docId));
            if (Platform.OS !== 'web') {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }, [documents, onDocumentsChange]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBg, { backgroundColor: arcaneColors.dangerMuted }]}>
            <ShieldAlert size={20} color={arcaneColors.danger} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Allergies (Medical)</Text>
            <Text style={styles.cardSubtitle}>Select all known allergens</Text>
          </View>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.chipGrid}>
          {TOP_ALLERGENS.map(allergen => {
            const isSelected = selectedAllergens.includes(allergen.label);
            return (
              <TouchableOpacity
                key={allergen.id}
                style={[styles.chip, isSelected && styles.chipSelectedDanger]}
                onPress={() => toggleAllergen(allergen.label)}
                activeOpacity={0.7}
                testID={`allergen-chip-${allergen.id}`}
              >
                <Text style={styles.chipIcon}>{allergen.icon}</Text>
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {allergen.label}
                </Text>
                {isSelected && <Check size={14} color="#FFFFFF" />}
              </TouchableOpacity>
            );
          })}
        </View>
        {customAllergens.length > 0 && (
          <View style={styles.customChipGrid}>
            {customAllergens.map(allergen => (
              <View key={allergen} style={[styles.chip, styles.chipSelectedDanger]}>
                <Text style={[styles.chipLabel, styles.chipLabelSelected]}>{allergen}</Text>
                <TouchableOpacity onPress={() => toggleAllergen(allergen)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.addCustomRow}>
          <TextInput
            style={styles.addCustomInput}
            placeholder="Add custom allergen..."
            placeholderTextColor={arcaneColors.textMuted}
            value={customAllergen}
            onChangeText={setCustomAllergen}
            onSubmitEditing={addCustomAllergen}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addCustomButton, !customAllergen.trim() && styles.addCustomButtonDisabled]}
            onPress={addCustomAllergen}
            disabled={!customAllergen.trim()}
          >
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.card, styles.cardSensitivity]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBg, { backgroundColor: arcaneColors.cautionMuted }]}>
            <Droplets size={20} color={arcaneColors.caution} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, { color: '#92400E' }]}>Skin Sensitivity / Eczema</Text>
            <Text style={[styles.cardSubtitle, { color: '#A16207' }]}>Track flare-up triggers</Text>
          </View>
        </View>
        <View style={[styles.cardDivider, { backgroundColor: '#FDE68A' }]} />

        <View style={styles.helperNote}>
          <Text style={styles.helperNoteText}>
            These are sensitivity triggers (not allergies). We'll flag ingredients that may cause skin reactions or flare-ups.
          </Text>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enable sensitivity tracking</Text>
          <Switch
            value={trackEczemaTriggers}
            onValueChange={onTrackEczemaTriggersChange}
            trackColor={{ false: '#D1D5DB', true: '#D97706' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {trackEczemaTriggers && (
          <>
            <Text style={styles.triggerCategoryLabel}>Food-based triggers</Text>
            <View style={styles.chipGrid}>
              {FOOD_SENSITIVITY_TRIGGERS.map(trigger => {
                const isSelected = eczemaTriggerGroups.includes(trigger.id);
                return (
                  <TouchableOpacity
                    key={trigger.id}
                    style={[styles.chip, isSelected && styles.chipSelectedCaution]}
                    onPress={() => toggleTriggerGroup(trigger.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipIcon}>{trigger.icon}</Text>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                      {trigger.label}
                    </Text>
                    {isSelected && <Check size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.triggerCategoryLabel}>Skincare irritants</Text>
            <View style={styles.chipGrid}>
              {ECZEMA_TRIGGER_GROUPS.map(group => {
                const isSelected = eczemaTriggerGroups.includes(group.id);
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[styles.chip, isSelected && styles.chipSelectedCaution]}
                    onPress={() => toggleTriggerGroup(group.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipIcon}>{group.icon}</Text>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                      {group.label}
                    </Text>
                    {isSelected && <Check size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBg, { backgroundColor: arcaneColors.safeMuted }]}>
            <Leaf size={20} color={arcaneColors.safe} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Dietary Rules</Text>
            <Text style={styles.cardSubtitle}>Religious, ethical & lifestyle choices</Text>
          </View>
        </View>
        <View style={[styles.cardDivider, { backgroundColor: arcaneColors.safeLight }]} />

        <View style={styles.dietaryRulesGrid}>
          {DIETARY_RULES.map(rule => {
            const isActive = dietaryRules.includes(rule.id);
            return (
              <TouchableOpacity
                key={rule.id}
                style={[styles.dietaryRuleCard, isActive && styles.dietaryRuleCardActive]}
                onPress={() => toggleDietaryRule(rule.id)}
                activeOpacity={0.7}
                testID={`dietary-rule-${rule.id}`}
              >
                <Text style={styles.dietaryRuleIcon}>{rule.icon}</Text>
                <Text style={[styles.dietaryRuleLabel, isActive && styles.dietaryRuleLabelActive]}>
                  {rule.label}
                </Text>
                {isActive && (
                  <View style={styles.dietaryRuleCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.avoidSection}>
          <Text style={styles.avoidSectionTitle}>Avoid Ingredients</Text>
          <View style={styles.chipGrid}>
            {COMMON_AVOID_INGREDIENTS.map(item => {
              const isSelected = avoidIngredients.includes(item.label);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, isSelected && styles.chipSelectedSafe]}
                  onPress={() => toggleAvoidIngredient(item.label)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipIcon}>{item.icon}</Text>
                  <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && <Check size={14} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
          {customAvoids.length > 0 && (
            <View style={styles.customChipGrid}>
              {customAvoids.map(item => (
                <View key={item} style={[styles.chip, styles.chipSelectedSafe]}>
                  <Text style={[styles.chipLabel, styles.chipLabelSelected]}>{item}</Text>
                  <TouchableOpacity onPress={() => toggleAvoidIngredient(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.addCustomRow}>
            <TextInput
              style={styles.addCustomInput}
              placeholder="Add ingredient to avoid..."
              placeholderTextColor={arcaneColors.textMuted}
              value={customAvoidIngredient}
              onChangeText={setCustomAvoidIngredient}
              onSubmitEditing={addCustomAvoidIngredient}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addCustomButton, styles.addCustomButtonSafe, !customAvoidIngredient.trim() && styles.addCustomButtonDisabled]}
              onPress={addCustomAvoidIngredient}
              disabled={!customAvoidIngredient.trim()}
            >
              <Plus size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showUploadRecords && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBg, { backgroundColor: arcaneColors.accentMuted }]}>
              <FileText size={20} color={arcaneColors.accent} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Medical Records</Text>
              <Text style={styles.cardSubtitle}>Upload allergy test results or prescriptions</Text>
            </View>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: arcaneColors.accentLight }]} />

          {documents.length > 0 && (
            <View style={styles.documentsList}>
              {documents.map(doc => (
                <View key={doc.id} style={styles.documentRow}>
                  <View style={styles.documentIcon}>
                    <FileText size={18} color={arcaneColors.accent} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>{doc.fileName}</Text>
                    <Text style={styles.documentDate}>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteDocument(doc.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.documentDeleteBtn}
                  >
                    <X size={16} color={arcaneColors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadRecord}
            activeOpacity={0.7}
          >
            <Upload size={20} color={arcaneColors.accent} />
            <Text style={styles.uploadButtonText}>Upload Records</Text>
          </TouchableOpacity>

          <View style={styles.comingSoonBanner}>
            <Clock size={14} color={arcaneColors.textMuted} />
            <Text style={styles.comingSoonText}>
              Auto-fill from records (OCR/AI) — planned
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    overflow: 'hidden',
    ...arcaneShadows.card,
  },
  cardSensitivity: {
    backgroundColor: '#FFFCF0',
    borderColor: '#FDE68A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cardIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
    marginTop: 2,
  },
  cardDivider: {
    height: 2,
    backgroundColor: arcaneColors.primaryLight,
    marginHorizontal: 16,
    borderRadius: 1,
    opacity: 0.4,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  customChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: arcaneRadius.pill,
    backgroundColor: arcaneColors.bgMist,
    borderWidth: 1.5,
    borderColor: arcaneColors.border,
  },
  chipSelectedDanger: {
    backgroundColor: arcaneColors.danger,
    borderColor: arcaneColors.danger,
  },
  chipSelectedCaution: {
    backgroundColor: arcaneColors.caution,
    borderColor: arcaneColors.caution,
  },
  chipSelectedSafe: {
    backgroundColor: arcaneColors.safe,
    borderColor: arcaneColors.safe,
  },
  chipIcon: {
    fontSize: 15,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
  addCustomRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  addCustomInput: {
    flex: 1,
    backgroundColor: arcaneColors.bgMist,
    borderRadius: arcaneRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: arcaneColors.text,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  addCustomButton: {
    width: 40,
    height: 40,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomButtonSafe: {
    backgroundColor: arcaneColors.safe,
  },
  addCustomButtonDisabled: {
    opacity: 0.4,
  },
  helperNote: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(253, 230, 138, 0.35)',
    borderRadius: arcaneRadius.md,
    padding: 10,
  },
  helperNoteText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: arcaneRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
    flex: 1,
    marginRight: 12,
  },
  triggerCategoryLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  dietaryRulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  dietaryRuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: arcaneRadius.lg,
    backgroundColor: arcaneColors.bgMist,
    borderWidth: 2,
    borderColor: arcaneColors.border,
    minWidth: 110,
  },
  dietaryRuleCardActive: {
    backgroundColor: arcaneColors.safe,
    borderColor: arcaneColors.safe,
  },
  dietaryRuleIcon: {
    fontSize: 18,
  },
  dietaryRuleLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    flex: 1,
  },
  dietaryRuleLabelActive: {
    color: '#FFFFFF',
  },
  dietaryRuleCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidSection: {
    marginTop: 8,
  },
  avoidSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: arcaneRadius.lg,
    borderWidth: 2,
    borderColor: arcaneColors.accentLight,
    borderStyle: 'dashed',
    backgroundColor: arcaneColors.accentMuted,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: arcaneColors.accent,
  },
  comingSoonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: arcaneColors.bgMist,
    borderRadius: arcaneRadius.md,
  },
  comingSoonText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    fontStyle: 'italic',
  },
  documentsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: arcaneColors.bgMist,
    borderRadius: arcaneRadius.md,
    padding: 12,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: arcaneColors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  documentDate: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    marginTop: 2,
  },
  documentDeleteBtn: {
    padding: 6,
  },
});
