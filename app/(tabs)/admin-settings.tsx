import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter, Href } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { BUILD_ID, APP_VERSION } from '@/constants/appVersion';
import {
  LogOut,
  Info,
  Shield,
  Stethoscope,
  RefreshCw,
  Trash2,
  ChevronRight,
  Eye,
  EyeOff,
  Database,
  Activity,
  Moon,
  Vibrate,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@allergy_guardian_admin_settings';

interface AdminSettings {
  enableHaptics: boolean;
  showDebugInfo: boolean;
  autoRefreshData: boolean;
  darkModeForced: boolean;
  verboseLogging: boolean;
}

const DEFAULT_SETTINGS: AdminSettings = {
  enableHaptics: true,
  showDebugInfo: false,
  autoRefreshData: true,
  darkModeForced: true,
  verboseLogging: false,
};

export default function AdminSettingsScreen() {
  const { currentUser, signOut, resetApp } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error loading admin settings:', error);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: AdminSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving admin settings:', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (settings.enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await loadSettings();
    setRefreshing(false);
  }, [loadSettings, settings.enableHaptics]);

  const toggleSetting = useCallback((key: keyof AdminSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    if (settings.enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          if (settings.enableHaptics) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          await signOut();
          router.replace('/welcome' as Href);
        },
      },
    ]);
  };

  const handleResetApp = async () => {
    Alert.alert(
      'Reset Application',
      'This will sign out and clear ALL local data including profiles, history, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            if (settings.enableHaptics) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
            try {
              await resetApp();
              router.replace('/welcome' as Href);
            } catch {
              Alert.alert('Error', 'Failed to reset application');
            }
          },
        },
      ]
    );
  };

  const navigateTo = (route: string) => {
    if (settings.enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(route as Href);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View>
          <View style={styles.headerTitleRow}>
            <Shield size={28} color="#7C3AED" />
            <Text style={styles.title}>Admin Settings</Text>
          </View>
          <Text style={styles.subtitle}>
            Configure application preferences
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
          <Text style={styles.sectionTitle}>Account</Text>
          
          <View style={styles.accountCard}>
            <View style={styles.accountAvatar}>
              <Shield size={32} color="#7C3AED" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountRole}>Administrator</Text>
              <Text style={styles.accountEmail}>{currentUser?.email}</Text>
              <Text style={styles.accountId}>ID: {currentUser?.id?.slice(0, 8)}...</Text>
            </View>
          </View>

          <View style={styles.signedInBanner}>
            <Text style={styles.signedInLabel}>Signed in as:</Text>
            <Text style={styles.signedInEmail}>{currentUser?.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Behavior</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#7C3AED20' }]}>
                <Vibrate size={20} color="#7C3AED" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Haptic Feedback</Text>
                <Text style={styles.settingDescription}>Vibration on interactions</Text>
              </View>
              <Switch
                value={settings.enableHaptics}
                onValueChange={() => toggleSetting('enableHaptics')}
                trackColor={{ false: '#374151', true: '#7C3AED50' }}
                thumbColor={settings.enableHaptics ? '#7C3AED' : '#6B7280'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#3B82F620' }]}>
                <RefreshCw size={20} color="#3B82F6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Auto Refresh Data</Text>
                <Text style={styles.settingDescription}>Refresh on tab focus</Text>
              </View>
              <Switch
                value={settings.autoRefreshData}
                onValueChange={() => toggleSetting('autoRefreshData')}
                trackColor={{ false: '#374151', true: '#3B82F650' }}
                thumbColor={settings.autoRefreshData ? '#3B82F6' : '#6B7280'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#10B98120' }]}>
                <Moon size={20} color="#10B981" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Force Dark Mode</Text>
                <Text style={styles.settingDescription}>Keep admin panel dark</Text>
              </View>
              <Switch
                value={settings.darkModeForced}
                onValueChange={() => toggleSetting('darkModeForced')}
                trackColor={{ false: '#374151', true: '#10B98150' }}
                thumbColor={settings.darkModeForced ? '#10B981' : '#6B7280'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer Options</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                {settings.showDebugInfo ? (
                  <Eye size={20} color="#F59E0B" />
                ) : (
                  <EyeOff size={20} color="#F59E0B" />
                )}
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Show Debug Info</Text>
                <Text style={styles.settingDescription}>Display technical details</Text>
              </View>
              <Switch
                value={settings.showDebugInfo}
                onValueChange={() => toggleSetting('showDebugInfo')}
                trackColor={{ false: '#374151', true: '#F59E0B50' }}
                thumbColor={settings.showDebugInfo ? '#F59E0B' : '#6B7280'}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#EF444420' }]}>
                <Activity size={20} color="#EF4444" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Verbose Logging</Text>
                <Text style={styles.settingDescription}>Detailed console output</Text>
              </View>
              <Switch
                value={settings.verboseLogging}
                onValueChange={() => toggleSetting('verboseLogging')}
                trackColor={{ false: '#374151', true: '#EF444450' }}
                thumbColor={settings.verboseLogging ? '#EF4444' : '#6B7280'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => navigateTo('/diagnostics')}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
              <Stethoscope size={20} color="#F59E0B" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>System Diagnostics</Text>
              <Text style={styles.settingDescription}>Run health checks</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => navigateTo('/(tabs)/admin-monitor')}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#10B98120' }]}>
              <Activity size={20} color="#10B981" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Live Monitor</Text>
              <Text style={styles.settingDescription}>View active sessions & errors</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => navigateTo('/(tabs)/admin-data')}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#3B82F620' }]}>
              <Database size={20} color="#3B82F6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Data Management</Text>
              <Text style={styles.settingDescription}>Export, import, and clear data</Text>
            </View>
            <ChevronRight size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>{BUILD_ID}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{Platform.OS}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mode</Text>
              <Text style={styles.infoValue}>{__DEV__ ? 'Development' : 'Production'}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Admin Mode</Text>
              <Text style={[styles.infoValue, { color: '#10B981' }]}>Active</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.signOutButton]}
            onPress={handleSignOut}
          >
            <LogOut size={20} color="#F59E0B" />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton]}
            onPress={handleResetApp}
          >
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.resetButtonText}>Reset Application</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Info size={16} color="#6B7280" />
          <Text style={styles.footerText}>
            Allergy Guardian Admin Panel {APP_VERSION} ({BUILD_ID})
          </Text>
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
  accountCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 16,
    alignItems: 'center',
  },
  accountAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7C3AED20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountRole: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  accountId: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  signedInBanner: {
    backgroundColor: '#10B98115',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  signedInLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  signedInEmail: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  settingCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 10,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 10,
    gap: 14,
  },
  infoCard: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#374151',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  signOutButton: {
    backgroundColor: '#F59E0B15',
    borderColor: '#F59E0B',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  resetButton: {
    backgroundColor: '#EF444415',
    borderColor: '#EF4444',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
