import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import {
  Database,
  Trash2,
  Download,
  Upload,
  ScanLine,
  Heart,
  ShoppingCart,
  Users,
  FileJson,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Copy,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { getScanHistory, clearScanHistory } from '@/storage/scanHistory';
import { getFavorites } from '@/storage/favorites';
import { getShoppingList, clearShoppingList } from '@/storage/shoppingList';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageStats {
  profiles: number;
  scans: number;
  favorites: number;
  shoppingItems: number;
  totalKeys: number;
}

export default function AdminDataScreen() {
  const { profiles, clearAllData } = useProfiles();
  const { users } = useUser();
  
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats>({
    profiles: 0,
    scans: 0,
    favorites: 0,
    shoppingItems: 0,
    totalKeys: 0,
  });
  const [exportData, setExportData] = useState<string | null>(null);

  const loadStorageStats = useCallback(async () => {
    try {
      const [scans, favorites, shoppingList, allKeys] = await Promise.all([
        getScanHistory(),
        getFavorites(),
        getShoppingList(),
        AsyncStorage.getAllKeys(),
      ]);

      setStorageStats({
        profiles: profiles.length,
        scans: scans.length,
        favorites: favorites.length,
        shoppingItems: shoppingList.length,
        totalKeys: allKeys.length,
      });
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  }, [profiles.length]);

  useEffect(() => {
    loadStorageStats();
  }, [loadStorageStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadStorageStats();
    setRefreshing(false);
  }, [loadStorageStats]);

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const [scans, favorites, shoppingList, allKeys] = await Promise.all([
        getScanHistory(),
        getFavorites(),
        getShoppingList(),
        AsyncStorage.getAllKeys(),
      ]);

      const allData: Record<string, any> = {};
      for (const key of allKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            try {
              allData[key] = JSON.parse(value);
            } catch {
              allData[key] = value;
            }
          }
        } catch (e) {
          console.error(`Error reading key ${key}:`, e);
        }
      }

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        platform: Platform.OS,
        stats: {
          profiles: profiles.length,
          users: users.length,
          scans: scans.length,
          favorites: favorites.length,
          shoppingItems: shoppingList.length,
        },
        data: allData,
      };

      const jsonString = JSON.stringify(exportPayload, null, 2);
      setExportData(jsonString);

      if (Platform.OS !== 'web') {
        await Share.share({
          message: jsonString,
          title: 'Allergy Guardian Data Export',
        });
      } else {
        Alert.alert(
          'Export Ready',
          'Data has been prepared. Use "Copy to Clipboard" to copy the data.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (exportData) {
      try {
        if (Platform.OS === 'web') {
          await navigator.clipboard.writeText(exportData);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Copied', 'Data has been copied to clipboard');
      } catch {
        Alert.alert('Error', 'Failed to copy data. Try using Share instead.');
      }
    } else {
      Alert.alert('No Data', 'Please export data first');
    }
  };

  const handleClearScanHistory = () => {
    Alert.alert(
      'Clear Scan History',
      `This will permanently delete ${storageStats.scans} scan history items. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await clearScanHistory();
              await loadStorageStats();
              Alert.alert('Success', 'Scan history cleared');
            } catch {
              Alert.alert('Error', 'Failed to clear scan history');
            }
          },
        },
      ]
    );
  };

  const handleClearShoppingList = () => {
    Alert.alert(
      'Clear Shopping List',
      `This will permanently delete ${storageStats.shoppingItems} shopping list items. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await clearShoppingList();
              await loadStorageStats();
              Alert.alert('Success', 'Shopping list cleared');
            } catch {
              Alert.alert('Error', 'Failed to clear shopping list');
            }
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete ALL profiles and related data. This action cannot be undone. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await clearAllData();
              await loadStorageStats();
              Alert.alert('Success', 'All data has been cleared');
            } catch {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const statCards = [
    {
      label: 'Profiles',
      value: storageStats.profiles,
      icon: Users,
      color: '#7C3AED',
    },
    {
      label: 'Scans',
      value: storageStats.scans,
      icon: ScanLine,
      color: '#3B82F6',
    },
    {
      label: 'Favorites',
      value: storageStats.favorites,
      icon: Heart,
      color: '#EF4444',
    },
    {
      label: 'Shopping',
      value: storageStats.shoppingItems,
      icon: ShoppingCart,
      color: '#10B981',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View>
          <View style={styles.headerTitleRow}>
            <Database size={28} color="#7C3AED" />
            <Text style={styles.title}>Data Management</Text>
          </View>
          <Text style={styles.subtitle}>
            Export, import, and manage application data
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <RefreshCw size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
          />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Overview</Text>
          <View style={styles.statsGrid}>
            {statCards.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <View key={index} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                    <IconComponent size={20} color={stat.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.totalCard}>
            <HardDrive size={20} color="#9CA3AF" />
            <Text style={styles.totalLabel}>Total Storage Keys:</Text>
            <Text style={styles.totalValue}>{storageStats.totalKeys}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export & Backup</Text>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleExportData}
            disabled={isLoading}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Download size={24} color="#3B82F6" />
              )}
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Export All Data</Text>
              <Text style={styles.actionDescription}>
                Download all application data as JSON for backup
              </Text>
            </View>
            <FileJson size={20} color="#6B7280" />
          </TouchableOpacity>

          {exportData && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleCopyToClipboard}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
                <Copy size={24} color="#10B981" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Copy to Clipboard</Text>
                <Text style={styles.actionDescription}>
                  Copy exported data to clipboard
                </Text>
              </View>
              <CheckCircle size={20} color="#10B981" />
            </TouchableOpacity>
          )}

          <View style={[styles.actionCard, styles.disabledCard]}>
            <View style={[styles.actionIcon, { backgroundColor: '#6B728020' }]}>
              <Upload size={24} color="#6B7280" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, styles.disabledText]}>Import Data</Text>
              <Text style={styles.actionDescription}>
                Restore data from a backup file (Coming soon)
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selective Cleanup</Text>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleClearScanHistory}
            disabled={storageStats.scans === 0}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F59E0B20' }]}>
              <ScanLine size={24} color="#F59E0B" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Clear Scan History</Text>
              <Text style={styles.actionDescription}>
                Remove {storageStats.scans} scanned product records
              </Text>
            </View>
            <Trash2 size={18} color="#F59E0B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleClearShoppingList}
            disabled={storageStats.shoppingItems === 0}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F59E0B20' }]}>
              <ShoppingCart size={24} color="#F59E0B" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Clear Shopping List</Text>
              <Text style={styles.actionDescription}>
                Remove {storageStats.shoppingItems} shopping list items
              </Text>
            </View>
            <Trash2 size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          <TouchableOpacity
            style={[styles.actionCard, styles.dangerCard]}
            onPress={handleClearAllData}
          >
            <View style={[styles.actionIcon, styles.dangerIcon]}>
              <AlertTriangle size={24} color="#EF4444" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, styles.dangerText]}>
                Clear All Data
              </Text>
              <Text style={styles.actionDescription}>
                Permanently delete all profiles, history, and preferences
              </Text>
            </View>
            <Trash2 size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              All data is stored locally on this device using AsyncStorage.
              Export your data regularly to prevent data loss. Cloud sync
              is available through Supabase when signed in.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 20,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 75,
    backgroundColor: '#1F2937',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  actionCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
    gap: 14,
    alignItems: 'center',
  },
  disabledCard: {
    opacity: 0.5,
  },
  dangerCard: {
    borderColor: '#EF4444',
    backgroundColor: '#1F2937',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIcon: {
    backgroundColor: '#FEE2E2',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  disabledText: {
    color: '#6B7280',
  },
  dangerText: {
    color: '#EF4444',
  },
  actionDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
  },
});
