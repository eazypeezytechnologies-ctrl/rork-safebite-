import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { FileText, Upload, Trash2, Clock, Eye, ImageIcon, ShieldAlert, Droplets, StickyNote } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useProfiles } from '@/contexts/ProfileContext';
import { ProfileDocument, DocumentCategory } from '@/types';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { RuneCard } from '@/components/RuneCard';

export default function ProfileRecordsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profiles, updateProfile } = useProfiles();
  const profile = profiles.find(p => p.id === id);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('general');

  const handleUpload = useCallback(async () => {
    const docs = profile?.profileDocuments || [];

    const pickCategory = (): Promise<DocumentCategory> => {
      return new Promise((resolve) => {
        Alert.alert(
          'Document Type',
          'What kind of record is this?',
          [
            { text: 'Allergy Record', onPress: () => resolve('allergy') },
            { text: 'Eczema Record', onPress: () => resolve('eczema') },
            { text: 'General Notes', onPress: () => resolve('general') },
          ],
          { cancelable: false },
        );
      });
    };

    try {
      const category = await pickCategory();

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && profile) {
        const asset = result.assets[0];
        const newDoc: ProfileDocument = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          profileId: profile.id,
          fileName: asset.fileName || `Record_${new Date().toLocaleDateString()}`,
          fileType: asset.mimeType || 'image/jpeg',
          fileUri: asset.uri,
          uploadedAt: new Date().toISOString(),
          category,
          pendingConfirmation: false,
        };

        const updatedDocs = [...docs, newDoc];
        await updateProfile({
          ...profile,
          profileDocuments: updatedDocs,
          updatedAt: new Date().toISOString(),
        });

        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('[ProfileRecords] Upload error:', error);
      Alert.alert('Error', 'Failed to upload record. Please try again.');
    }
  }, [profile, updateProfile]);

  const handleDelete = useCallback((docId: string, docName: string) => {
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete "${docName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!profile) return;
            try {
              const currentDocs = profile.profileDocuments || [];
              const updatedDocs = currentDocs.filter(d => d.id !== docId);
              await updateProfile({
                ...profile,
                profileDocuments: updatedDocs,
                updatedAt: new Date().toISOString(),
              });
              if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error('[ProfileRecords] Delete error:', error);
              Alert.alert('Error', 'Failed to delete record.');
            }
          },
        },
      ]
    );
  }, [profile, updateProfile]);

  const documents = profile?.profileDocuments || [];
  const allergyDocs = documents.filter(d => d.category === 'allergy');
  const eczemaDocs = documents.filter(d => d.category === 'eczema');
  const generalDocs = documents.filter(d => !d.category || d.category === 'general');

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${profile.name} — Records`, headerTintColor: arcaneColors.primary }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Medical Records</Text>
          <Text style={styles.subtitle}>
            Upload allergy test results, prescriptions, or other medical documents for {profile.name}.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.uploadCard}
          onPress={handleUpload}
          activeOpacity={0.7}
        >
          <View style={styles.uploadIconBg}>
            <Upload size={24} color={arcaneColors.accent} />
          </View>
          <Text style={styles.uploadTitle}>Upload Records</Text>
          <Text style={styles.uploadSubtitle}>Tap to pick an image from your library</Text>
        </TouchableOpacity>

        <RuneCard variant="accent">
          <View style={styles.comingSoonRow}>
            <Clock size={16} color={arcaneColors.textMuted} />
            <Text style={styles.comingSoonText}>
              Auto-fill from records (OCR/AI) — planned
            </Text>
          </View>
        </RuneCard>

        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={arcaneColors.border} />
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload allergy test results or prescriptions to keep everything in one place.
            </Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            <Text style={styles.recordsCount}>
              {documents.length} record{documents.length !== 1 ? 's' : ''}
            </Text>
            {documents.map(doc => {
              const isImage = doc.fileType?.startsWith('image/');
              return (
                <View key={doc.id} style={styles.recordCard}>
                  <View style={styles.recordContent}>
                    <View style={[styles.recordIconBg, isImage && styles.recordIconBgImage]}>
                      {doc.category === 'allergy' ? (
                        <ShieldAlert size={20} color={arcaneColors.danger} />
                      ) : doc.category === 'eczema' ? (
                        <Droplets size={20} color={arcaneColors.caution} />
                      ) : isImage ? (
                        <ImageIcon size={20} color={arcaneColors.accent} />
                      ) : (
                        <FileText size={20} color={arcaneColors.primary} />
                      )}
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordName} numberOfLines={1}>{doc.fileName}</Text>
                      <View style={styles.recordMeta}>
                        <Text style={styles.recordDate}>
                          {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        {doc.category && (
                          <View style={[
                            styles.categoryBadge,
                            doc.category === 'allergy' && styles.categoryBadgeAllergy,
                            doc.category === 'eczema' && styles.categoryBadgeEczema,
                          ]}>
                            <Text style={[
                              styles.categoryBadgeText,
                              doc.category === 'allergy' && { color: arcaneColors.danger },
                              doc.category === 'eczema' && { color: arcaneColors.caution },
                            ]}>
                              {doc.category === 'allergy' ? 'Allergy' : doc.category === 'eczema' ? 'Eczema' : 'General'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {isImage && doc.fileUri && (
                    <TouchableOpacity
                      style={styles.previewThumb}
                      onPress={() => setPreviewUri(doc.fileUri)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: doc.fileUri }} style={styles.thumbImage} />
                    </TouchableOpacity>
                  )}

                  <View style={styles.recordActions}>
                    {isImage && (
                      <TouchableOpacity
                        style={styles.recordActionBtn}
                        onPress={() => setPreviewUri(doc.fileUri)}
                      >
                        <Eye size={18} color={arcaneColors.primary} />
                        <Text style={styles.recordActionText}>View</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.recordActionBtn, styles.recordActionBtnDanger]}
                      onPress={() => handleDelete(doc.id, doc.fileName)}
                    >
                      <Trash2 size={18} color={arcaneColors.danger} />
                      <Text style={[styles.recordActionText, styles.recordActionTextDanger]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {previewUri && (
        <TouchableOpacity
          style={styles.previewOverlay}
          onPress={() => setPreviewUri(null)}
          activeOpacity={1}
        >
          <View style={styles.previewContainer}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewUri(null)}
            >
              <Text style={styles.previewCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
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
    backgroundColor: arcaneColors.bg,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: arcaneColors.danger,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: arcaneColors.textSecondary,
    lineHeight: 20,
  },
  uploadCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: arcaneRadius.xl,
    borderWidth: 2,
    borderColor: arcaneColors.accentLight,
    borderStyle: 'dashed',
    backgroundColor: arcaneColors.accentMuted,
    marginBottom: 16,
    ...arcaneShadows.card,
  },
  uploadIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(109, 40, 217, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: arcaneColors.accent,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
  },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  comingSoonText: {
    fontSize: 13,
    color: arcaneColors.textMuted,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: arcaneColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  recordsList: {
    marginTop: 8,
    gap: 12,
  },
  recordsCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  recordCard: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    ...arcaneShadows.card,
  },
  recordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  recordIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: arcaneColors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIconBgImage: {
    backgroundColor: arcaneColors.accentMuted,
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  recordDate: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    marginTop: 3,
  },
  previewThumb: {
    width: '100%',
    height: 160,
    borderRadius: arcaneRadius.md,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: arcaneColors.bgMist,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: arcaneRadius.md,
  },
  recordActions: {
    flexDirection: 'row',
    gap: 10,
  },
  recordActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.bgMist,
  },
  recordActionBtnDanger: {
    backgroundColor: arcaneColors.dangerMuted,
  },
  recordActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
  },
  recordActionTextDanger: {
    color: arcaneColors.danger,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  previewContainer: {
    width: '90%',
    height: '70%',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '90%',
    borderRadius: arcaneRadius.lg,
  },
  previewCloseBtn: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: arcaneRadius.pill,
    backgroundColor: arcaneColors.bgCard,
  },
  previewCloseText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: arcaneColors.bgMist,
  },
  categoryBadgeAllergy: {
    backgroundColor: arcaneColors.dangerMuted,
  },
  categoryBadgeEczema: {
    backgroundColor: arcaneColors.cautionMuted,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
  },
});
