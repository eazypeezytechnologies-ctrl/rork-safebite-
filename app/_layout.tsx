import { Stack, useRouter, useSegments, Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ProfileProvider, useProfiles } from "@/contexts/ProfileContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { LiveDataContext } from "@/contexts/LiveDataContext";
import { FamilyProvider } from "@/contexts/FamilyContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { View, Platform, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ArcaneSpinner } from "@/components/ArcaneSpinner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { restoreStorageFromServer, syncStorageToServer } from "@/utils/storageSync";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FamilyErrorBoundary } from "@/components/FamilyErrorBoundary";
import { trpc, trpcClient } from "@/lib/trpc";
import { BUILD_ID } from "@/constants/appVersion";
import { ReduceMotionProvider } from "@/contexts/ReduceMotionContext";
import { LimitedModeBanner } from "@/components/LimitedModeBanner";
import { runSimpleConnectionCheck } from "@/utils/supabaseHealth";
import { MysticToastProvider, MysticToastRenderer } from "@/components/MysticToast";
import { arcaneColors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

console.log('===========================================');
console.log('[APP START] BUILD_ID:', BUILD_ID);
console.log('===========================================');

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    const name = reason?.name || '';
    const isNetworkError = (
      msg.includes('Load failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('fetch failed') ||
      msg.includes('Network request failed') ||
      msg.includes('NetworkError') ||
      msg.includes('CORS') ||
      msg.includes('AbortError') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      name === 'AbortError' ||
      name === 'TypeError'
    );
    if (isNetworkError) {
      if (__DEV__) console.warn('[GlobalErrorHandler] Suppressed network rejection:', msg);
      event.preventDefault();
      return;
    }
    console.warn('[GlobalErrorHandler] Unhandled rejection:', msg);
  });
}

const MAX_LOADING_TIME = 800;
const SHOW_SKIP_AFTER = 400;

function RootLayoutNav() {
  const { isLoading: profilesLoadingRaw, profiles, clearAllData: clearProfileData, profilesFetchComplete, hasFetchError } = useProfiles();
  const profilesLoading = profilesLoadingRaw && !hasFetchError;
  const { isLoading: userLoading, currentUser, hasCompletedOnboarding, clearAllData: clearUserData } = useUser();
  const router = useRouter();
  const segments = useSegments();
  const [isInitialized, setIsInitialized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'initial' | 'session' | 'profiles' | 'ready'>('initial');
  const [justSignedIn, setJustSignedIn] = useState(false);
  const signInGraceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [limitedMode, setLimitedMode] = useState(false);
  const [limitedBannerVisible, setLimitedBannerVisible] = useState(false);
  const healthCheckDoneRef = React.useRef(false);

  useEffect(() => {
    const initialize = async () => {
      if (Platform.OS === 'web') {
        await restoreStorageFromServer();
        
        const params = new URLSearchParams(window.location.search);
        if (params.get('reset') === 'true') {
          console.log('Reset parameter detected, clearing all data...');
          await clearProfileData();
          await clearUserData();
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };
    
    initialize();
  }, [clearProfileData, clearUserData]);

  useEffect(() => {
    if (Platform.OS === 'web' && !profilesLoading && !userLoading) {
      syncStorageToServer();
    }
  }, [profilesLoading, userLoading, currentUser, profiles]);

  useEffect(() => {
    const skipTimerId = setTimeout(() => {
      if (!isInitialized) {
        setShowSkip(true);
      }
    }, SHOW_SKIP_AFTER);

    const timeoutId = setTimeout(() => {
      if (!isInitialized) {
        console.log('[Navigation] Loading timeout reached, forcing initialization');
        setLoadingTimeout(true);
        setAuthChecked(true);
        setIsInitialized(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    }, MAX_LOADING_TIME);
    
    return () => {
      clearTimeout(skipTimerId);
      clearTimeout(timeoutId);
    };
  }, [isInitialized]);

  useEffect(() => {
    if (userLoading) {
      setLoadingPhase('session');
    } else if (profilesLoading) {
      setLoadingPhase('profiles');
    } else {
      setLoadingPhase('ready');
    }
  }, [userLoading, profilesLoading]);

  useEffect(() => {
    const isLoading = profilesLoading || userLoading;
    
    if (!isLoading && !isInitialized) {
      const timer = setTimeout(() => {
        setAuthChecked(true);
        setIsInitialized(true);
        SplashScreen.hideAsync().catch(() => {});
        console.log('[Navigation] Initialized - user:', !!currentUser, 'onboarding:', hasCompletedOnboarding);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [profilesLoading, userLoading, isInitialized, currentUser, hasCompletedOnboarding]);

  useEffect(() => {
    if (!isInitialized || !authChecked) return;
    
    const currentPath = segments.join('/');
    const isAdmin = currentUser?.isAdmin || false;
    console.log('[Navigation] Check - path:', currentPath, 'onboarding:', hasCompletedOnboarding, 'user:', !!currentUser, 'isAdmin:', isAdmin, 'profiles:', profiles.length, 'fetchComplete:', profilesFetchComplete, 'fetchError:', hasFetchError);
    
    const isInAuthFlow = currentPath === 'welcome' || currentPath === 'forgot-password' || currentPath === 'reset-password';
    
    if (currentPath === 'reset-password') {
      return;
    }
    
    const isInWizard = currentPath === 'wizard';
    const isInMainApp = currentPath.startsWith('(tabs)');
    const isInModalPage = currentPath.startsWith('product/') || 
                          currentPath.startsWith('ai-analysis/') || 
                          currentPath === 'edit-profile' || 
                          currentPath === 'emergency-card' ||
                          currentPath === 'admin-users' ||
                          currentPath === 'family-management' ||
                          currentPath === 'scan-emergency-qr' ||
                          currentPath === 'diagnostics' ||
                          currentPath === 'security-checklist' ||
                          currentPath === 'welcome-tour' ||
                          currentPath === 'exposure-guidance' ||
                          currentPath === 'epipen-demo' ||
                          currentPath === 'manual-ingredient-entry' ||
                          currentPath === 'profile-records';
    
    if (!hasCompletedOnboarding || !currentUser) {
      if (!isInAuthFlow) {
        console.log('[Navigation] Not authenticated, redirecting to welcome');
        requestAnimationFrame(() => {
          router.replace('/welcome' as Href);
        });
      }
      return;
    }
    
    // User is authenticated but still on welcome page - navigate them away
    if (currentPath === 'welcome') {
      console.log('[Navigation] Authenticated user on welcome. isAdmin:', isAdmin, 'profilesFetchComplete:', profilesFetchComplete, 'profiles:', profiles.length, 'justSignedIn:', justSignedIn);
      
      // For admins, go directly to admin dashboard
      if (isAdmin) {
        requestAnimationFrame(() => {
          router.replace('/(tabs)/admin-dashboard' as Href);
        });
        return;
      }
      
      // Wait for profiles to load before deciding where to navigate
      // This prevents redirecting returning users to wizard while their profiles are still loading
      if (!profilesFetchComplete && !hasFetchError) {
        console.log('[Navigation] Waiting for profiles to load before navigating away from welcome');
        return;
      }
      
      // If user has profiles, go to main app
      if (profiles.length > 0) {
        console.log('[Navigation] User has profiles, going to main app');
        requestAnimationFrame(() => {
          router.replace('/(tabs)/(scan)' as Href);
        });
        return;
      }
      
      // User has no profiles - allow them into main app anyway
      // They can create profiles from within the app
      // This handles returning users who might have deleted profiles or have sync issues
      console.log('[Navigation] User has no profiles, going to main app (can create profiles there)');
      requestAnimationFrame(() => {
        router.replace('/(tabs)/(scan)' as Href);
      });
      return;
    }
    
    if (isAdmin) {
      if (!isInMainApp && !isInAuthFlow && !isInModalPage) {
        console.log('[Navigation] Admin user detected, redirecting to admin dashboard');
        requestAnimationFrame(() => {
          router.replace('/(tabs)/admin-dashboard' as Href);
        });
      }
      return;
    }
    
    if (hasCompletedOnboarding && currentUser && isInWizard) {
      console.log('[Navigation] User is in wizard after auth, allowing them to continue');
      return;
    }
    
    // IMPORTANT: For returning users (hasCompletedOnboarding=true), NEVER force wizard
    // They can create profiles from within the main app if needed
    // Only redirect to wizard for brand new users who just signed up and have no profiles
    if (hasCompletedOnboarding && currentUser) {
      // This is a returning user - always let them into the main app
      if (!isInMainApp && !isInAuthFlow && !isInWizard && !isInModalPage) {
        console.log('[Navigation] Returning user detected, going to main app (profiles:', profiles.length, ')');
        requestAnimationFrame(() => {
          router.replace('/(tabs)/(scan)' as Href);
        });
      }
      return;
    }
    
    // Only reach here for users who haven't completed onboarding (brand new signups)
    // Wait for profiles fetch before deciding
    if (profilesFetchComplete && !hasFetchError && profiles.length === 0 && !isInWizard && !isInAuthFlow && !justSignedIn) {
      console.log('[Navigation] New user with no profiles, redirecting to wizard');
      requestAnimationFrame(() => {
        router.replace('/wizard' as Href);
      });
      return;
    }
    
    // If there's a fetch error but user is authenticated, let them into the app
    // They can retry loading profiles from within the app
    if (hasFetchError && !isInMainApp && !isInAuthFlow && !isInWizard && !isInModalPage) {
      console.log('[Navigation] Fetch error occurred, allowing user into main app to retry');
      requestAnimationFrame(() => {
        router.replace('/(tabs)/(scan)' as Href);
      });
      return;
    }
    
    if (profiles.length > 0 && !isInMainApp && !isInAuthFlow && !isInWizard && !isInModalPage) {
      console.log('[Navigation] Has profiles, redirecting to main app');
      requestAnimationFrame(() => {
        router.replace('/(tabs)/(scan)' as Href);
      });
    }
  }, [isInitialized, authChecked, hasCompletedOnboarding, currentUser, profiles.length, profilesFetchComplete, hasFetchError, router, segments, justSignedIn]);

  // Set grace period when user signs in to allow profiles to load from server
  useEffect(() => {
    if (currentUser && hasCompletedOnboarding) {
      console.log('[Navigation] User signed in, starting grace period for profile loading');
      setJustSignedIn(true);
      
      // Clear any existing timer
      if (signInGraceTimerRef.current) {
        clearTimeout(signInGraceTimerRef.current);
      }
      
      // Give 8 seconds for profiles to load from Supabase (extended for slow connections)
      signInGraceTimerRef.current = setTimeout(() => {
        console.log('[Navigation] Sign-in grace period ended');
        setJustSignedIn(false);
      }, 8000);
    }
    
    return () => {
      if (signInGraceTimerRef.current) {
        clearTimeout(signInGraceTimerRef.current);
      }
    };
  }, [currentUser, hasCompletedOnboarding]);

  useEffect(() => {
    if (healthCheckDoneRef.current) return;
    if (isInitialized && currentUser) {
      healthCheckDoneRef.current = true;
      console.log('[Layout] Running background health check...');
      runSimpleConnectionCheck().then((result) => {
        console.log('[Layout] Health check result:', result.message);
        if (!result.ok) {
          setLimitedMode(true);
          setLimitedBannerVisible(true);
        }
      }).catch((err) => {
        console.warn('[Layout] Health check error:', err);
        setLimitedMode(true);
        setLimitedBannerVisible(true);
      });
    }
  }, [isInitialized, currentUser]);

  const handleRetryLimitedMode = React.useCallback(() => {
    console.log('[Layout] Retrying health check from limited mode banner...');
    runSimpleConnectionCheck().then((result) => {
      if (result.ok) {
        setLimitedMode(false);
        setLimitedBannerVisible(false);
        console.log('[Layout] Health check passed, exiting limited mode');
      }
    }).catch(() => {});
  }, []);

  const handleDismissLimitedMode = React.useCallback(() => {
    setLimitedBannerVisible(false);
  }, []);

  const handleSkip = () => {
    console.log('[Navigation] User skipped loading');
    setLoadingTimeout(true);
    setAuthChecked(true);
    setIsInitialized(true);
    SplashScreen.hideAsync().catch(() => {});
  };

  if ((profilesLoading || userLoading || !isInitialized || !authChecked) && !loadingTimeout && !hasFetchError && !limitedMode) {
    const getLoadingMessage = () => {
      switch (loadingPhase) {
        case 'session': return 'Connecting to server...';
        case 'profiles': return 'Loading your profiles...';
        default: return 'Starting up...';
      }
    };

    const getLoadingHint = () => {
      if (showSkip) {
        return 'Taking longer than expected? Tap below to continue.';
      }
      return '';
    };

    const loadingHint = getLoadingHint();

    return (
      <View style={layoutStyles.loadingContainer}>
        <View style={layoutStyles.loadingIconContainer}>
          <ArcaneSpinner size={52} />
        </View>
        <Text style={layoutStyles.loadingText}>{getLoadingMessage()}</Text>
        {loadingHint ? (
          <Text style={layoutStyles.loadingSubtext}>{loadingHint}</Text>
        ) : null}
        {showSkip && (
          <TouchableOpacity style={layoutStyles.skipButton} onPress={handleSkip}>
            <Text style={layoutStyles.skipButtonText}>Continue Anyway</Text>
          </TouchableOpacity>
        )}
        <View style={layoutStyles.progressDotsContainer}>
          <View style={[layoutStyles.progressDot, loadingPhase !== 'initial' && layoutStyles.progressDotActive]} />
          <View style={[layoutStyles.progressDot, loadingPhase === 'profiles' || loadingPhase === 'ready' ? layoutStyles.progressDotActive : null]} />
          <View style={[layoutStyles.progressDot, loadingPhase === 'ready' && layoutStyles.progressDotActive]} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LimitedModeBanner
        visible={limitedBannerVisible}
        message={limitedMode ? 'Limited mode: some online features unavailable' : null}
        onRetry={handleRetryLimitedMode}
        onDismiss={handleDismissLimitedMode}
      />
      <Stack screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: arcaneColors.headerBg },
        headerTintColor: arcaneColors.primary,
        headerTitleStyle: { color: arcaneColors.headerText, fontWeight: '600' as const },
        headerShadowVisible: false,
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="wizard" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="product/[code]" options={{ title: "Product Details" }} />
      <Stack.Screen name="ai-analysis/[code]" options={{ title: "AI Analysis" }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="emergency-card" options={{ title: "Emergency Card" }} />
      <Stack.Screen name="admin-users" options={{ title: "Admin Users" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
      <Stack.Screen name="family-management" options={{ title: "Family Groups" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
      <Stack.Screen name="scan-emergency-qr" options={{ title: "Scan Emergency QR" }} />
      <Stack.Screen name="exposure-guidance" options={{ title: "Exposure Guidance" }} />
      <Stack.Screen name="epipen-demo" options={{ title: "EpiPen Demo" }} />
      <Stack.Screen name="welcome-tour" options={{ title: "Welcome Tour" }} />
      <Stack.Screen name="manual-ingredient-entry" options={{ title: "Manual Entry" }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ title: "Subscription" }} />
      <Stack.Screen name="accept-invite" options={{ title: "Family Invitation" }} />
        <Stack.Screen name="security-checklist" options={{ title: "Security Checklist" }} />
      </Stack>
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: arcaneColors.bg,
    paddingHorizontal: 24,
  },
  loadingSigil: {
    fontSize: 32,
    color: arcaneColors.accent,
    opacity: 0.3,
    marginBottom: 4,
  },
  loadingIconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    letterSpacing: 0.3,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: arcaneColors.textMuted,
    textAlign: 'center' as const,
  },
  skipButton: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: arcaneColors.primary,
    borderRadius: 12,
    shadowColor: arcaneColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  progressDotsContainer: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: arcaneColors.borderLight,
  },
  progressDotActive: {
    backgroundColor: arcaneColors.primary,
  },
});

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: 1,
        networkMode: 'offlineFirst',
      },
    },
  }));

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <ReduceMotionProvider>
              <MysticToastProvider>
                <UserProvider>
                  <ProfileProvider>
                    <FamilyErrorBoundary>
                      <FamilyProvider>
                        <SubscriptionProvider>
                          <LiveDataContext>
                            <RootLayoutNav />
                            <MysticToastRenderer />
                          </LiveDataContext>
                        </SubscriptionProvider>
                      </FamilyProvider>
                    </FamilyErrorBoundary>
                  </ProfileProvider>
                </UserProvider>
              </MysticToastProvider>
            </ReduceMotionProvider>
          </trpc.Provider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
