import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Globe, Languages } from 'lucide-react-native';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { translateText, isTranslationAvailable, TranslationResult } from '@/services/translationService';

interface DirectTranslationProps {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  isEnglish: boolean;
  onReportIssue?: () => void;
  testID?: string;
}

interface AutoTranslateProps {
  label: string;
  text: string;
  autoTranslate?: boolean;
  compact?: boolean;
  testID?: string;
}

type TranslationCardProps = DirectTranslationProps | AutoTranslateProps;

function isAutoTranslateProps(props: TranslationCardProps): props is AutoTranslateProps {
  return 'text' in props && 'label' in props;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  ru: 'Russian',
  hi: 'Hindi',
  nl: 'Dutch',
  sv: 'Swedish',
  pl: 'Polish',
  tr: 'Turkish',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  he: 'Hebrew',
};

function getLanguageLabel(code: string): string {
  if (!code) return 'Unknown';
  const lower = code.toLowerCase().trim();
  if (LANGUAGE_LABELS[lower]) return LANGUAGE_LABELS[lower];
  if (lower.length > 3) return code.charAt(0).toUpperCase() + code.slice(1);
  return code.toUpperCase();
}

async function copyToClipboard(text: string) {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } else {
      await Clipboard.setStringAsync(text);
    }
  } catch (err) {
    console.warn('[TranslationCard] Copy failed:', err);
  }
}

function TranslationCardDirect({
  originalText,
  translatedText,
  detectedLanguage,
  isEnglish,
  onReportIssue,
  testID,
}: DirectTranslationProps) {
  const handleCopyOriginal = useCallback(() => {
    copyToClipboard(originalText);
  }, [originalText]);

  const handleCopyTranslated = useCallback(() => {
    copyToClipboard(translatedText);
  }, [translatedText]);

  if (isEnglish) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Languages size={18} color={arcaneColors.accent} />
        </View>
        <Text style={styles.headerTitle}>Translation</Text>
        <View style={styles.langBadge}>
          <Globe size={12} color={arcaneColors.textSecondary} />
          <Text style={styles.langBadgeText}>{getLanguageLabel(detectedLanguage)}</Text>
        </View>
      </View>

      <View style={styles.panelsRow}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>Original</Text>
            <TouchableOpacity
              onPress={handleCopyOriginal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.copyBtn}
            >
              <Copy size={14} color={arcaneColors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.panelText} selectable>{originalText}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelLabel, styles.panelLabelEnglish]}>English</Text>
            <TouchableOpacity
              onPress={handleCopyTranslated}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.copyBtn}
            >
              <Copy size={14} color={arcaneColors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.panelText} selectable>{translatedText}</Text>
        </View>
      </View>

      {onReportIssue && (
        <TouchableOpacity style={styles.reportBtn} onPress={onReportIssue}>
          <Text style={styles.reportBtnText}>Report translation issue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TranslationCardAuto({
  label,
  text,
  autoTranslate,
  compact,
  testID,
}: AutoTranslateProps) {
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!autoTranslate || !text || text.trim().length === 0) return;
    let cancelled = false;
    setLoading(true);
    translateText(text).then((result) => {
      if (!cancelled) {
        setTranslationResult(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [text, autoTranslate]);

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]} testID={testID}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={arcaneColors.accent} />
          <Text style={styles.loadingText}>Detecting language...</Text>
        </View>
      </View>
    );
  }

  if (!translationResult || !isTranslationAvailable(translationResult)) {
    return null;
  }

  return (
    <TranslationCardDirect
      originalText={translationResult.originalText}
      translatedText={translationResult.translatedText}
      detectedLanguage={translationResult.detectedLanguage}
      isEnglish={translationResult.isEnglish}
      testID={testID}
    />
  );
}

export const TranslationCard = React.memo(function TranslationCard(props: TranslationCardProps) {
  if (isAutoTranslateProps(props)) {
    return <TranslationCardAuto {...props} />;
  }
  return <TranslationCardDirect {...props} />;
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    borderColor: arcaneColors.borderAccent,
    overflow: 'hidden',
    marginBottom: 10,
    ...arcaneShadows.card,
  },
  containerCompact: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: arcaneColors.accentMuted,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.borderAccent,
    gap: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(109, 40, 217, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: arcaneColors.accent,
    letterSpacing: 0.3,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: arcaneColors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: arcaneRadius.pill,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
  },
  panelsRow: {
    padding: 12,
    gap: 0,
  },
  panel: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: arcaneColors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  panelLabelEnglish: {
    color: arcaneColors.primary,
  },
  copyBtn: {
    padding: 4,
  },
  panelText: {
    fontSize: 14,
    lineHeight: 20,
    color: arcaneColors.text,
  },
  divider: {
    height: 1,
    backgroundColor: arcaneColors.borderLight,
    marginHorizontal: -12,
    marginVertical: 2,
  },
  reportBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: arcaneColors.borderLight,
    alignItems: 'center',
  },
  reportBtnText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    fontWeight: '500' as const,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  loadingText: {
    fontSize: 13,
    color: arcaneColors.textMuted,
  },
});
