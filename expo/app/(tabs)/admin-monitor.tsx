import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Users,
  ScanLine,
  Heart,
  ShoppingCart,
  Database,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@/contexts/UserContext';
import { useProfiles } from '@/contexts/ProfileContext';
import { getScanHistory } from '@/storage/scanHistory';
import { getFavorites } from '@/storage/favorites';
import { getShoppingList } from '@/storage/shoppingList';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LiveUser {
  id: string;
  email: string;
  isOnline: boolean;
  lastSeen: string;
}

export default function AdminMonitorScreen() {
  const insets = useSafeAreaInsets();
  const { users, currentUser, connectionStatus, refreshUsers, getRecentActivities } = useUser();
  const { profiles } = useProfiles();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [scanCount, setScanCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [storageKeys, setStorageKeys] = useState(0);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);

  const loadMonitorData = useCallback(async () => {
    try {
      const [scanHistory, favorites, shoppingList, allKeys, activities] = await Promise.all([
        getScanHistory(),
        getFavorites(),
        getShoppingList(),
        AsyncStorage.getAllKeys(),
        getRecentActivities(),
      ]);

      setStorageKeys(allKeys.length);
      setScanCount(scanHistory.length);
      setFavCount(favorites.length);
      setShopCount(shoppingList.length);

      try {
        await refreshUsers();
        const now = new Date();
        const list: LiveUser[] = users.map(u => {
          const userActs = activities.filter((a: any) => a.userId === u.id);
          const last = userActs[0];
          const lastDate = last ? new Date(last.timestamp) : new Date(u.createdAt);
          const mins = (now.getTime() - lastDate.getTime()) / 60000;
          return { id: u.id, email: u.email, isOnline: mins < 5, lastSeen: lastDate.toISOString() };
        });
        setLiveUsers(list);
      } catch {}
    } catch (e) {
      console.error('[AdminMonitor] Error:', e);
    }
  }, [connectionStatus, users, getRecentActivities, refreshUsers]);

  useEffect(() => {
    loadMonitorData();
    const iv = setInterval(() => { loadMonitorData(); setLastUpdated(new Date()); }, 30000);
    return () => clearInterval(iv);
  }, [loadMonitorData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadMonitorData();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadMonitorData]);

  const getTimeAgo = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const connColor = connectionStatus === 'connected' ? '#10B981' : connectionStatus === 'error' ? '#EF4444' : connectionStatus === 'slow' ? '#F97316' : '#9CA3AF';
  const connText = connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Error' : connectionStatus === 'slow' ? 'Slow' : 'Idle';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={s.row}>
            <Activity size={24} color="#7C3AED" />
            <Text style={s.title}>Live Monitor</Text>
          </View>
          <Text style={s.sub}>Updated: {getTimeAgo(lastUpdated)}</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}>
        <View style={s.banner}>
          <View style={[s.dot, { backgroundColor: connColor }]} />
          <Text style={s.bannerText}>{connText}</Text>
          {currentUser && <Text style={s.bannerEmail}>{currentUser.email}</Text>}
        </View>

        <Text style={s.sectionTitle}>Metrics</Text>
        <View style={s.grid}>
          {[
            { label: 'Scans', val: scanCount, Icon: ScanLine, color: '#3B82F6' },
            { label: 'Favorites', val: favCount, Icon: Heart, color: '#EF4444' },
            { label: 'Shopping', val: shopCount, Icon: ShoppingCart, color: '#10B981' },
            { label: 'Profiles', val: profiles.length, Icon: Users, color: '#7C3AED' },
            { label: 'Users', val: users.length, Icon: Users, color: '#0891B2' },
            { label: 'Storage', val: storageKeys, Icon: Database, color: '#F59E0B' },
          ].map((m, i) => (
            <View key={i} style={s.card}>
              <m.Icon size={18} color={m.color} />
              <Text style={s.cardVal}>{m.val}</Text>
              <Text style={s.cardLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Users ({liveUsers.length})</Text>
        {liveUsers.length === 0 ? (
          <View style={s.empty}>
            <Users size={28} color="#6B7280" />
            <Text style={s.emptyText}>No users found</Text>
          </View>
        ) : (
          liveUsers.map((u, i) => (
            <View key={i} style={s.userRow}>
              {u.isOnline ? <Wifi size={14} color="#10B981" /> : <WifiOff size={14} color="#6B7280" />}
              <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
              <Text style={s.userTime}>{getTimeAgo(new Date(u.lastSeen))}</Text>
            </View>
          ))
        )}

        <View style={s.statusCard}>
          <Text style={s.statusTitle}>System Status</Text>
          <View style={s.statusRow}>
            <CheckCircle size={16} color={connectionStatus === 'error' ? '#EF4444' : '#10B981'} />
            <Text style={s.statusText}>API: {connectionStatus === 'error' ? 'Error' : 'Online'}</Text>
          </View>
          <View style={s.statusRow}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={s.statusText}>Platform: {Platform.OS}</Text>
          </View>
          <View style={s.statusRow}>
            {storageKeys > 50 ? <AlertTriangle size={16} color="#F59E0B" /> : <CheckCircle size={16} color="#10B981" />}
            <Text style={s.statusText}>Storage: {storageKeys} keys</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1F2937', borderBottomWidth: 1, borderBottomColor: '#374151' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '700' as const, color: '#FFF' },
  sub: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED15', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 12, borderRadius: 10, marginBottom: 16, gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bannerText: { fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
  bannerEmail: { fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFF', marginBottom: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { backgroundColor: '#1F2937', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#374151', alignItems: 'center', minWidth: 100, flex: 1 },
  cardVal: { fontSize: 22, fontWeight: '700' as const, color: '#FFF', marginTop: 6 },
  cardLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  empty: { backgroundColor: '#1F2937', padding: 32, borderRadius: 12, borderWidth: 1, borderColor: '#374151', alignItems: 'center', gap: 12, marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#374151', marginBottom: 8, gap: 10 },
  userEmail: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
  userTime: { fontSize: 11, color: '#6B7280' },
  statusCard: { backgroundColor: '#1F2937', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#374151', marginTop: 16, gap: 10 },
  statusTitle: { fontSize: 15, fontWeight: '700' as const, color: '#FFF', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13, color: '#D1D5DB' },
});
