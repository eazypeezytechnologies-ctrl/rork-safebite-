import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Send,
  ChevronDown,
  CheckCircle,
  Camera,
  AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@/contexts/UserContext';
import { useProfiles } from '@/contexts/ProfileContext';
import { createIssue } from '@/services/adminSupportService';
import { APP_VERSION } from '@/constants/appVersion';
import {
  IssueType,
  AppSection,
  IssueSeverity,
  ISSUE_TYPE_LABELS,
  APP_SECTION_LABELS,
} from '@/types/adminSupport';

const ISSUE_TYPES: IssueType[] = [
  'scan_failed',
  'product_not_found',
  'missing_ingredient_data',
  'allergen_warning_wrong',
  'eczema_result_wrong',
  'category_incorrect',
  'login_problem',
  'profile_not_saving',
  'app_loading_freeze',
  'sync_history_issue',
  'other',
];

const APP_SECTIONS: AppSection[] = [
  'scanner',
  'product_detail',
  'profiles',
  'history',
  'settings',
  'login',
  'shopping_list',
  'recalls',
  'other',
];

function inferSeverity(type: IssueType): IssueSeverity {
  switch (type) {
    case 'login_problem':
    case 'app_loading_freeze':
      return 'high';
    case 'scan_failed':
    case 'allergen_warning_wrong':
    case 'eczema_result_wrong':
      return 'medium';
    default:
      return 'low';
  }
}

export default function ReportIssueScreen() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { activeProfile } = useProfiles();
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [appSection, setAppSection] = useState<AppSection>('other');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!issueType) throw new Error('Select an issue type');
      if (!description.trim()) throw new Error('Please describe the issue');

      return createIssue({
        user_id: currentUser?.id || 'anonymous',
        user_email: currentUser?.email,
        issue_type: issueType,
        description: description.trim(),
        app_section: appSection,
        barcode: barcode.trim() || undefined,
        product_name: productName.trim() || undefined,
        device_platform: Platform.OS,
        app_version: APP_VERSION,
        profile_id: activeProfile?.id || undefined,
        profile_name: activeProfile?.name || undefined,
        severity: inferSeverity(issueType),
        status: 'new',
        is_repeated: false,
        product_data_incomplete: false,
        category_corrected: false,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit issue');
    },
  });

  if (submitted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Report Issue', headerStyle: { backgroundColor: '#FFFFFF' }, headerTintColor: '#1A202C' }} />
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <CheckCircle size={48} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Issue Reported</Text>
          <Text style={styles.successSubtext}>
            Thank you for reporting this issue. Our support team will review it and get back to you.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Report Issue', headerStyle: { backgroundColor: '#FFFFFF' }, headerTintColor: '#1A202C' }} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <AlertTriangle size={20} color="#F59E0B" />
          <Text style={styles.headerText}>
            Help us improve SafeBite by reporting issues you encounter.
          </Text>
        </View>

        <Text style={styles.label}>Issue Type *</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => { setShowTypeDropdown(!showTypeDropdown); setShowSectionDropdown(false); }}
        >
          <Text style={[styles.dropdownText, !issueType && styles.dropdownPlaceholder]}>
            {issueType ? ISSUE_TYPE_LABELS[issueType] : 'Select issue type...'}
          </Text>
          <ChevronDown size={16} color="#6B7280" />
        </TouchableOpacity>
        {showTypeDropdown && (
          <View style={styles.dropdownList}>
            {ISSUE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.dropdownItem, issueType === type && styles.dropdownItemActive]}
                onPress={() => { setIssueType(type); setShowTypeDropdown(false); }}
              >
                <Text style={[styles.dropdownItemText, issueType === type && styles.dropdownItemTextActive]}>
                  {ISSUE_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>App Section</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => { setShowSectionDropdown(!showSectionDropdown); setShowTypeDropdown(false); }}
        >
          <Text style={styles.dropdownText}>{APP_SECTION_LABELS[appSection]}</Text>
          <ChevronDown size={16} color="#6B7280" />
        </TouchableOpacity>
        {showSectionDropdown && (
          <View style={styles.dropdownList}>
            {APP_SECTIONS.map((section) => (
              <TouchableOpacity
                key={section}
                style={[styles.dropdownItem, appSection === section && styles.dropdownItemActive]}
                onPress={() => { setAppSection(section); setShowSectionDropdown(false); }}
              >
                <Text style={[styles.dropdownItemText, appSection === section && styles.dropdownItemTextActive]}>
                  {APP_SECTION_LABELS[section]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe what happened..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Barcode (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 0123456789012"
          placeholderTextColor="#9CA3AF"
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Product Name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Organic Almond Butter"
          placeholderTextColor="#9CA3AF"
          value={productName}
          onChangeText={setProductName}
        />

        {activeProfile && (
          <View style={styles.profileTag}>
            <Text style={styles.profileTagLabel}>Linked Profile:</Text>
            <Text style={styles.profileTagName}>{activeProfile.name}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Platform</Text>
          <Text style={styles.metaValue}>{Platform.OS}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>App Version</Text>
          <Text style={styles.metaValue}>{APP_VERSION}</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!issueType || !description.trim()) && styles.submitBtnDisabled]}
          onPress={() => submitMutation.mutate()}
          disabled={!issueType || !description.trim() || submitMutation.isPending}
          activeOpacity={0.8}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Send size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownText: {
    fontSize: 15,
    color: '#1F2937',
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: {
    backgroundColor: '#EEF2FF',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownItemTextActive: {
    color: '#4F46E5',
    fontWeight: '600' as const,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
    minHeight: 100,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
  },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileTagLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  profileTagName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4F46E5',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  metaLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#374151',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnDisabled: {
    backgroundColor: '#C7D2FE',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  successWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  doneBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
