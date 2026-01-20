import { Tabs } from "expo-router";
import { ScanBarcode, Users, AlertCircle, History, LayoutDashboard, Settings, Database, ShoppingCart, Activity } from "lucide-react-native";
import React, { useMemo, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useUser } from "@/contexts/UserContext";
import { BUILD_ID } from "@/constants/appVersion";

export default function TabLayout() {
  const { currentUser, isLoading } = useUser();
  
  const { isAdmin, isReady } = useMemo(() => {
    if (isLoading) return { isAdmin: false, isReady: false };
    if (!currentUser) return { isAdmin: false, isReady: true };
    const adminStatus = currentUser.isAdmin === true;
    console.log('[TabLayout] Admin check - user:', currentUser.email, 'isAdmin:', adminStatus);
    return { isAdmin: adminStatus, isReady: true };
  }, [currentUser, isLoading]);

  useEffect(() => {
    console.log('[TabLayout] Rendering tabs - isAdmin:', isAdmin, 'isReady:', isReady, 'BUILD_ID:', BUILD_ID);
  }, [isAdmin, isReady]);

  if (!isReady) {
    return (
      <View style={tabStyles.loadingContainer}>
        <ActivityIndicator size="small" color="#0891B2" />
      </View>
    );
  }

  if (isAdmin) {
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#7C3AED",
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#1F2937",
            borderTopColor: "#374151",
            borderTopWidth: 1,
          },
          tabBarInactiveTintColor: "#9CA3AF",
        }}
      >
        <Tabs.Screen
          name="admin-dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-users-tab"
          options={{
            title: "Users",
            tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-data"
          options={{
            title: "Data",
            tabBarIcon: ({ color }) => <Database size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-monitor"
          options={{
            title: "Monitor",
            tabBarIcon: ({ color }) => <Activity size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="shopping-list"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="(scan)"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="profiles"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="recalls"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="history"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="admin-system-health"
          options={{ href: null }}
        />
      </Tabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0891B2",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E7EB",
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="(scan)"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => <ScanBarcode size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: "Profiles",
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recalls"
        options={{
          title: "Recalls",
          tabBarIcon: ({ color }) => <AlertCircle size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <History size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: "Shopping",
          tabBarIcon: ({ color }) => <ShoppingCart size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin-dashboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="admin-users-tab"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="admin-data"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="admin-settings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="admin-monitor"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="admin-system-health"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});
