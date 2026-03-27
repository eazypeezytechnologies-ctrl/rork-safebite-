import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Shield, ShieldAlert, ShieldQuestion } from 'lucide-react-native';
import { arcaneColors } from '@/constants/theme';

interface ConfidenceScoreBarProps {
  score: number;
  label?: string;
  showIcon?: boolean;
  compact?: boolean;
  testID?: string;
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#059669';
  if (score >= 65) return '#D97706';
  if (score >= 40) return '#EA580C';
  return '#DC2626';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Very High';
  if (score >= 75) return 'High';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Low';
  return 'Very Low';
}

function getScoreBg(score: number): string {
  if (score >= 85) return '#ECFDF5';
  if (score >= 65) return '#FFFBEB';
  if (score >= 40) return '#FFF7ED';
  return '#FEF2F2';
}

function getScoreDescription(score: number): string {
  if (score >= 90) return 'Comprehensive data available from a trusted source.';
  if (score >= 75) return 'Good data coverage. Some details may be incomplete.';
  if (score >= 60) return 'Partial data. Results should be verified on the physical label.';
  if (score >= 40) return 'Limited data. Always check the physical product label.';
  return 'Very little data available. Cannot reliably assess safety.';
}

export const ConfidenceScoreBar = React.memo(function ConfidenceScoreBar({
  score,
  label,
  showIcon = true,
  compact = false,
  testID,
}: ConfidenceScoreBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const color = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);
  const bgColor = getScoreBg(score);
  const description = getScoreDescription(score);
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: clampedScore,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedScore, animatedWidth]);

  const barWidth = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const ScoreIcon = clampedScore >= 75 ? Shield : clampedScore >= 40 ? ShieldAlert : ShieldQuestion;

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        <View style={styles.compactRow}>
          {showIcon && <ScoreIcon size={14} color={color} />}
          <Text style={[styles.compactLabel, { color }]}>{clampedScore}% {scoreLabel}</Text>
        </View>
        <View style={styles.compactTrack}>
          <Animated.View style={[styles.compactFill, { width: barWidth, backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor: color + '30' }]} testID={testID}>
      <View style={styles.headerRow}>
        {showIcon && (
          <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
            <ScoreIcon size={18} color={color} />
          </View>
        )}
        <View style={styles.headerContent}>
          <Text style={styles.title}>{label || 'Data Confidence'}</Text>
          <Text style={[styles.scoreText, { color }]}>{clampedScore}% — {scoreLabel}</Text>
        </View>
      </View>

      <View style={styles.trackContainer}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth, backgroundColor: color }]} />
        </View>
        <View style={styles.tickMarks}>
          <View style={styles.tick} />
          <View style={styles.tick} />
          <View style={styles.tick} />
          <View style={styles.tick} />
        </View>
        <View style={styles.tickLabels}>
          <Text style={styles.tickLabel}>0</Text>
          <Text style={styles.tickLabel}>25</Text>
          <Text style={styles.tickLabel}>50</Text>
          <Text style={styles.tickLabel}>75</Text>
          <Text style={styles.tickLabel}>100</Text>
        </View>
      </View>

      <Text style={styles.description}>{description}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    letterSpacing: 0.2,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 1,
  },
  trackContainer: {
    marginBottom: 10,
  },
  track: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  tickMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 2,
  },
  tick: {
    width: 1,
    height: 4,
    backgroundColor: '#D1D5DB',
  },
  tickLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  tickLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  description: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  compactContainer: {
    gap: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  compactTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactFill: {
    height: 4,
    borderRadius: 2,
  },
});
