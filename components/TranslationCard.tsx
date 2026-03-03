import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Languages, Globe, AlertCircle, ChevronDown, ChevronUp, Copy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { SigilBadge } from '@/components/SigilBadge';
import { translateText, isTranslationAvailable, TranslationResult } from '@/services/translationService';

interface TranslationCardProps {
  label: string;
  text: string;
  compact?: boolean;
  autoTranslate?: boolean;
  testID?: string;
}

export const TranslationCard = React.memo(function TranslationCard({
  label,
  text,
  compact = false,
  autoTranslate = false,
  testID,
}: TranslationCardProps) {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hasError, setHasError] = useState(false);

  const doTranslate = useCallback(async () => {
    if (!text || text.trim().length === 0) return;
    setIsLoading(true);
    setHasError(false);
    try {
      console.log('[TranslationCard] Translating:', label);
      const result = await translateText(text);
      setTranslation(result);
    } catch (err) {
      console.error('[TranslationCard] Translation error:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [text, label]);

  useEffect(() => {
    if (autoTranslate && text && text.trim().length > 0) {
      doTranslate();
    }
  }, [autoTranslate, text, doTranslate]);

  const handleCopy = useCallback(async (content: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(content);
      } else {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(content);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Alert.alert('Copied', 'Text copied to clipboard');
    } catch {
      console.warn('[TranslationCard] Copy failed');
    }
  }, []);

  const handleReport = useCallback(() => {
    Alert.alert(
      'Report Translation Issue',
      'Thank you for helping improve translations. What kind of issue did you notice?',
      [
        { text: 'Inaccurate Translation', onPress: () => console.log('[Translation] Report: inaccurate for', label) },
        { text: 'Wrong Language Detected', onPress: () => console.log('[Translation] Report: wrong language for', label) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [label]);

  const showTranslation = translation && isTranslationAvailable(translation);

  if (!text || text.trim().length === 0) return null;

  if (!showTranslation && !isLoading && translation) {
    return null;
  }

  if (!autoTranslate && !translation && !isLoading) {
    return (
      <TouchableOpacity
        testID={testID}
        style={styles.translateButton}
        onPress={doTranslate}
        activeOpacity={0.7}
      >
        <Languages size={16} color={arcaneColors.accent} />
        <Text style={styles.translateButtonText}>Translate {label}</Text>
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return (
      <View testID={testID} style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={arcaneColors.accent} />
        <Text style={styles.loadingText}>Translating {label.toLowerCase()}...</Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <TouchableOpacity
        testID={testID}
        style={styles.errorContainer}
        onPress={doTranslate}
        activeOpacity={0.7}
      >
        <AlertCircle size={14} color={arcaneColors.caution} />
        <Text style={styles.errorText}>Translation failed. Tap to retry.</Text>
      </TouchableOpacity>
    );
  }

  if (!showTranslation) return null;

  return (
    <View testID={testID} style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Globe size={14} color={arcaneColors.accent} />
          <Text style={styles.headerLabel}>{label} Translation</Text>
          <SigilBadge
            label={translation.detectedLanguage.toUpperCase()}
            status="legendary"
            size="sm"
          />
        </View>
        {expanded ? (
          <ChevronUp size={16} color={arcaneColors.textMuted} />
        ) : (
          <ChevronDown size={16} color={arcaneColors.textMuted} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.textBlock}>
            <View style={styles.textBlockHeader}>
              <Text style={styles.textBlockLabel}>Original</Text>
              <TouchableOpacity
                onPress={() => handleCopy(translation.originalText)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Copy size={12} color={arcaneColors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.originalText, compact && styles.compactText]}
              selectable
              numberOfLines={compact ? 4 : undefined}
            >
              {translation.originalText}
            </Text>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Languages size={12} color={arcaneColors.accentLight} />
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.textBlock}>
            <View style={styles.textBlockHeader}>
              <Text style={styles.textBlockLabelEnglish}>English</Text>
              <TouchableOpacity
                onPress={() => handleCopy(translation.translatedText)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Copy size={12} color={arcaneColors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.translatedText, compact && styles.compactText]}
              selectable
              numberOfLines={compact ? 4 : undefined}
            >
              {translation.translatedText}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.reportButton}
            onPress={handleReport}
            activeOpacity={0.7}
          >
            <AlertCircle size={11} color={arcaneColors.textMuted} />
            <Text style={styles.reportText}>Report translation issue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    borderColor: arcaneColors.borderAccent,
    overflow: 'hidden',
    marginBottom: 12,
    ...arcaneShadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: arcaneColors.accentMuted,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.borderAccent,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.accent,
    letterSpacing: 0.3,
  },
  body: {
    padding: 14,
  },
  textBlock: {
    marginBottom: 4,
  },
  textBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  textBlockLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  textBlockLabelEnglish: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: arcaneColors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  originalText: {
    fontSize: 14,
    color: arcaneColors.textSecondary,
    lineHeight: 20,
  },
  translatedText: {
    fontSize: 14,
    color: arcaneColors.text,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  compactText: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: arcaneColors.borderAccent,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingTop: 8,
  },
  reportText: {
    fontSize: 11,
    color: arcaneColors.textMuted,
  },
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: arcaneRadius.pill,
    backgroundColor: arcaneColors.accentMuted,
    borderWidth: 1,
    borderColor: arcaneColors.borderAccent,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  translateButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.accent,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: arcaneRadius.lg,
    backgroundColor: arcaneColors.accentMuted,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 13,
    color: arcaneColors.accent,
    fontWeight: '500' as const,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: arcaneRadius.lg,
    backgroundColor: arcaneColors.cautionMuted,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: arcaneColors.caution,
    fontWeight: '500' as const,
  },
});
