import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const widthValue = typeof width === 'number' ? width : width as any;
  const heightValue = typeof height === 'number' ? height : height as any;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: widthValue,
          height: heightValue,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonProductCard() {
  return (
    <View style={styles.productCard}>
      <Skeleton width="100%" height={200} borderRadius={16} style={{ marginBottom: 16 }} />
      
      <View style={styles.productHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width="60%" height={24} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={16} />
        </View>
        <Skeleton width={64} height={64} borderRadius={32} />
      </View>

      <View style={styles.section}>
        <Skeleton width="30%" height={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="95%" height={16} />
      </View>

      <View style={styles.section}>
        <Skeleton width="40%" height={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={120} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonProfileCard() {
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileContent}>
        <Skeleton width={56} height={56} borderRadius={28} style={{ marginRight: 16 }} />
        <View style={{ flex: 1 }}>
          <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={14} />
        </View>
        <Skeleton width={60} height={32} borderRadius={16} />
      </View>
      <View style={styles.profileActions}>
        <Skeleton width="48%" height={44} borderRadius={12} />
        <Skeleton width="48%" height={44} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={styles.listItem}>
      <View style={styles.listItemContent}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
          <Skeleton width="50%" height={14} />
        </View>
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>
    </View>
  );
}

export function SkeletonSearchResult() {
  return (
    <View style={styles.searchResult}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Skeleton width="80%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="60%" height={14} />
      </View>
      <Skeleton width={40} height={40} borderRadius={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchResult: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
