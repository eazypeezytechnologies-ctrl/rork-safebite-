import React, { useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { Stack, useRouter, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';
import SystemHealthDashboard from '@/components/SystemHealthDashboard';
import { ShieldAlert } from 'lucide-react-native';

export default function AdminSystemHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, isLoading } = useUser();

  const isAdmin = currentUser?.isAdmin === true;

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      console.log('[AdminSystemHealth] Non-admin user detected, redirecting');
      router.replace('/(tabs)/(scan)' as Href);
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.loadingText}>Verifying access...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ShieldAlert size={64} color="#EF4444" />
        <Text style={styles.unauthorizedTitle}>Access Denied</Text>
        <Text style={styles.unauthorizedText}>You do not have permission to view this page.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: 'System Health'
        }} 
      />
      <SystemHealthDashboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  unauthorizedTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  unauthorizedText: {
    marginTop: 8,
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    paddingHorizontal: 32,
  },
});
