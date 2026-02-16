import createContextHook from '@nkzw/create-context-hook';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { migrateToSupabase, checkMigrationStatus } from '@/utils/supabaseMigration';
import { withTimeout, withRetry, getAuthErrorMessage } from '@/utils/authTimeout';
import { AppState, AppStateStatus } from 'react-native';
import { logAuditEvent } from '@/utils/auditLog';
import { actionRateLimiter } from '@/utils/actionRateLimiter';

const ONBOARDING_KEY = '@allergy_guardian_onboarding_complete';
const CACHED_AUTH_KEY = '@allergy_guardian_cached_auth';
const USER_ACTIVITY_KEY = '@allergy_guardian_user_activity';
const AUTH_TIMEOUT = 10000;
const SESSION_TIMEOUT = 6000;
const ADMIN_EMAILS = [
  'eazypeezytechnologies@gmail.com',
];

export const [UserProvider, useUser] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'slow' | 'error' | 'idle'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const queryClient = useQueryClient();
  const loadingAbortRef = useRef<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const triggerMigration = useCallback(async (userId: string) => {
    try {
      const alreadyMigrated = await checkMigrationStatus();
      if (alreadyMigrated) {
        return;
      }

      console.log('[UserContext] Starting background migration...');
      
      const result = await migrateToSupabase(userId);
      
      if (result.success) {
        console.log('[UserContext] Migration successful');
      } else {
        console.error('[UserContext] Migration had errors:', result.errors?.length || 0);
      }
    } catch (error) {
      console.error('[UserContext] Migration failed:', error);
    }
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[UserContext] App state changed:', appStateRef.current, '->', nextAppState);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[UserContext] App came to foreground - refreshing state');
        if (isLoading && connectionStatus === 'connecting') {
          console.log('[UserContext] Force completing load after app resume');
          setConnectionStatus('idle');
          setIsLoading(false);
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isLoading, connectionStatus]);

  useEffect(() => {
    let slowConnectionTimer: ReturnType<typeof setTimeout>;
    let loadingTimeoutTimer: ReturnType<typeof setTimeout>;
    loadingAbortRef.current = false;

    const loadData = async () => {
      try {
        console.log('[UserContext] Loading user session...');
        setConnectionStatus('connecting');
        
        slowConnectionTimer = setTimeout(() => {
          if (!loadingAbortRef.current) {
            setConnectionStatus('slow');
          }
        }, 2000);

        loadingTimeoutTimer = setTimeout(() => {
          if (!loadingAbortRef.current && isLoading) {
            console.log('[UserContext] Force completing load due to timeout');
            loadingAbortRef.current = true;
            setConnectionStatus('idle');
            setIsLoading(false);
          }
        }, 5000);
        
        const [onboarding, cachedAuth] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(CACHED_AUTH_KEY),
        ]);
        
        if (loadingAbortRef.current) return;
        
        setHasCompletedOnboarding(onboarding === 'true');

        if (cachedAuth) {
          try {
            const cached = JSON.parse(cachedAuth);
            if (cached.email && cached.id) {
              console.log('[UserContext] Using cached auth for instant startup');
              const cachedUser: User = {
                id: cached.id,
                email: cached.email,
                isAdmin: cached.isAdmin || false,
                createdAt: cached.createdAt,
              };
              setCurrentUser(cachedUser);
            }
          } catch {
            console.log('[UserContext] Failed to parse cached auth');
          }
        }

        if (loadingAbortRef.current) return;

        let sessionResult;
        try {
          sessionResult = await withTimeout(
            supabase.auth.getSession(),
            SESSION_TIMEOUT,
            'Session check timed out'
          );
        } catch (sessionError) {
          console.log('[UserContext] Session check timed out or failed:', sessionError);
          clearTimeout(slowConnectionTimer);
          clearTimeout(loadingTimeoutTimer);
          
          if (loadingAbortRef.current) return;
          
          const cachedAuthData = await AsyncStorage.getItem(CACHED_AUTH_KEY);
          if (cachedAuthData) {
            try {
              const cached = JSON.parse(cachedAuthData);
              if (cached.email && cached.id) {
                console.log('[UserContext] Using cached auth due to connection timeout');
                const cachedUser: User = {
                  id: cached.id,
                  email: cached.email,
                  isAdmin: cached.isAdmin || false,
                  createdAt: cached.createdAt,
                };
                setCurrentUser(cachedUser);
                setConnectionStatus('idle');
                setIsLoading(false);
                return;
              }
            } catch {
              // Failed to parse cached auth
            }
          }
          
          setConnectionStatus('idle');
          setIsLoading(false);
          return;
        }
        
        if (loadingAbortRef.current) return;
        
        clearTimeout(slowConnectionTimer);
        clearTimeout(loadingTimeoutTimer);
        const session = sessionResult.data.session;
        
        if (session?.user) {
          if (__DEV__) console.log('[UserContext] Found active session:', session.user.email);
          logAuditEvent({ eventType: 'auth.sign_in', userId: session.user.id, metadata: { method: 'session_restore' } });
          setConnectionStatus('connected');
          const isAdmin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase() || '');
          
          let userData = null;
          try {
            const result = await withTimeout(
              Promise.resolve(supabase.from('users').select('*').eq('id', session.user.id).single()),
              4000
            ) as { data: any; error: any };
            if (!result.error || result.error.code === 'PGRST116') {
              userData = result.data;
            }
          } catch {
            if (__DEV__) console.log('[UserContext] User data fetch timed out, using session data');
          }

          const user: User = {
            id: session.user.id,
            email: session.user.email || '',
            isAdmin: userData?.is_admin || isAdmin,
            createdAt: userData?.created_at || session.user.created_at,
          };

          const serverOnboardingComplete = userData?.settings?.onboarding_complete === true;
          const localOnboardingComplete = onboarding === 'true';
          
          const isReturningUser = userData !== null && userData !== undefined;
          
          if ((serverOnboardingComplete || isReturningUser) && !localOnboardingComplete) {
            console.log('[UserContext] Restoring onboarding status for returning user - hasUserData:', isReturningUser, 'serverFlag:', serverOnboardingComplete);
            setHasCompletedOnboarding(true);
            AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
            
            if (!serverOnboardingComplete && isReturningUser) {
              console.log('[UserContext] Syncing onboarding_complete flag to server for returning user');
              supabase.from('users').update({ 
                settings: { ...userData.settings, onboarding_complete: true }
              }).eq('id', session.user.id).then(() => {});
            }
          }

          AsyncStorage.setItem(CACHED_AUTH_KEY, JSON.stringify({
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
          })).catch(() => {});

          if (!userData) {
            if (__DEV__) console.log('[UserContext] User not in DB, creating user record...');
            supabase.from('users').insert({
              id: user.id,
              email: user.email,
              is_admin: user.isAdmin,
            }).then(() => { if (__DEV__) console.log('[UserContext] User record created'); });
          } else if (isAdmin && !userData.is_admin) {
            if (__DEV__) console.log('[UserContext] Upgrading user to admin...');
            supabase.from('users').update({ is_admin: true }).eq('id', user.id)
              .then(() => { if (__DEV__) console.log('[UserContext] Admin upgraded'); });
            user.isAdmin = true;
          }

          setCurrentUser(user);
          setConnectionStatus('idle');
          setIsLoading(false);

          setTimeout(() => {
            triggerMigration(user.id).catch(() => {});
          }, 2000);
          
          if (user.isAdmin) {
            supabase.from('users').select('*').then(({ data: allUsers }) => {
              if (allUsers) {
                const mappedUsers: User[] = allUsers.map(u => ({
                  id: u.id,
                  email: u.email,
                  isAdmin: u.is_admin || false,
                  createdAt: u.created_at,
                }));
                setUsers(mappedUsers);
              }
            });
          }
        } else {
          if (__DEV__) console.log('[UserContext] No active session found');
          await AsyncStorage.removeItem(CACHED_AUTH_KEY);
          setCurrentUser(null);
          setConnectionStatus('idle');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        clearTimeout(slowConnectionTimer);
        clearTimeout(loadingTimeoutTimer);
        setConnectionStatus('error');
        setIsLoading(false);
      }
    };

    loadData();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        const isAdminByEmail = ADMIN_EMAILS.includes(session.user.email?.toLowerCase() || '');
        console.log('Admin check - email:', session.user.email, 'isAdmin:', isAdminByEmail);
        
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          isAdmin: isAdminByEmail,
          createdAt: session.user.created_at,
        };

        setCurrentUser(user);
        
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error && error.code === 'PGRST116') {
            console.log('Creating new user record with admin:', isAdminByEmail);
            await supabase.from('users').insert({
              id: user.id,
              email: user.email,
              is_admin: isAdminByEmail,
            });
          } else if (userData) {
            if (isAdminByEmail && !userData.is_admin) {
              console.log('Upgrading user to admin in database');
              await supabase.from('users').update({ is_admin: true }).eq('id', user.id);
            }
            const finalIsAdmin = isAdminByEmail || userData.is_admin;
            if (finalIsAdmin !== user.isAdmin) {
              console.log('Updating local admin status to:', finalIsAdmin);
              setCurrentUser({ ...user, isAdmin: finalIsAdmin });
            }
          }
        } catch (dbError) {
          console.error('Error checking/updating user in DB:', dbError);
        }

        setTimeout(() => {
          triggerMigration(user.id).catch(() => {});
        }, 2000);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      loadingAbortRef.current = true;
      clearTimeout(slowConnectionTimer);
      clearTimeout(loadingTimeoutTimer);
      authListener.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerMigration]);

  const signIn = useCallback(async (email: string, password: string, isSignup: boolean = false) => {
    setConnectionStatus('connecting');
    setRetryCount(0);
    
    try {
      console.log(isSignup ? 'Creating account:' : 'Signing in:', email);
      
      const rateLimitAction = isSignup ? 'auth.signup' : 'auth.login';
      const rateCheck = actionRateLimiter.check(rateLimitAction);
      if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
      }

      if (isSignup) {
        const { data, error } = await withRetry(
          () => supabase.auth.signUp({ email, password }),
          {
            timeout: AUTH_TIMEOUT,
            maxRetries: 2,
            onRetry: (attempt) => {
              setRetryCount(attempt);
              setConnectionStatus('slow');
              if (__DEV__) console.log(`[UserContext] Signup retry attempt ${attempt}`);
            },
          }
        );

        if (error) {
          setConnectionStatus('error');
          if (error.message.includes('already registered')) {
            throw new Error('An account with this email already exists. Please sign in instead.');
          }
          throw error;
        }

        if (data.user) {
          setConnectionStatus('connected');
          const isAdminByEmail = ADMIN_EMAILS.includes(email.toLowerCase());
          console.log('Signup - email:', email, 'isAdmin:', isAdminByEmail);
          
          supabase.from('users').insert({
            id: data.user.id,
            email: email,
            is_admin: isAdminByEmail,
          }).then(() => console.log('User record created'));

          const user: User = {
            id: data.user.id,
            email: email,
            isAdmin: isAdminByEmail,
            createdAt: data.user.created_at,
          };

          setCurrentUser(user);
          setConnectionStatus('idle');
          console.log('Account created successfully, isAdmin:', isAdminByEmail);
          logAuditEvent({ eventType: 'auth.sign_up', userId: user.id });
        }
      } else {
        const { data, error } = await withRetry(
          () => supabase.auth.signInWithPassword({ email, password }),
          {
            timeout: AUTH_TIMEOUT,
            maxRetries: 1,
            retryDelay: 1500,
            onRetry: (attempt) => {
              setRetryCount(attempt);
              setConnectionStatus('slow');
              console.log(`[UserContext] Sign-in retry attempt ${attempt}`);
            },
          }
        );

        if (error) {
          setConnectionStatus('error');
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password. Please try again.');
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please check your email and confirm your account before signing in.');
          }
          throw error;
        }

        if (data.user) {
          setConnectionStatus('connected');
          const isAdminByEmail = ADMIN_EMAILS.includes(email.toLowerCase());
          console.log('Sign in - email:', email, 'isAdminByEmail:', isAdminByEmail);
          
          let userData = null;
          try {
            const result = await withTimeout(
              Promise.resolve(supabase.from('users').select('*').eq('id', data.user.id).single()),
              5000
            ) as { data: any; error: any };
            userData = result.data;
          } catch {
            console.log('[signIn] User data fetch timed out, proceeding with email-based admin check');
          }
          
          const finalIsAdmin = isAdminByEmail || (userData?.is_admin === true);
          
          const user: User = {
            id: data.user.id,
            email: email,
            isAdmin: finalIsAdmin,
            createdAt: data.user.created_at,
          };

          if (isAdminByEmail && userData && !userData.is_admin) {
            console.log('Updating database to grant admin rights');
            supabase.from('users').update({ is_admin: true }).eq('id', data.user.id).then(() => {});
          }
          
          if (!userData) {
            console.log('Creating user record in database');
            supabase.from('users').insert({
              id: user.id,
              email: user.email,
              is_admin: finalIsAdmin,
            }).then(() => {});
          }

          setCurrentUser(user);
          setConnectionStatus('idle');
          console.log('Signed in successfully, isAdmin:', finalIsAdmin);
          logAuditEvent({ eventType: 'auth.sign_in', userId: user.id, metadata: { method: 'password' } });
          
          console.log('[signIn] User signed in successfully, marking onboarding complete');
          setHasCompletedOnboarding(true);
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          
          await AsyncStorage.setItem(CACHED_AUTH_KEY, JSON.stringify({
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
          }));

          setTimeout(() => {
            triggerMigration(user.id).catch(() => {});
          }, 2000);
        }
      }
    } catch (error) {
      if (__DEV__) console.log('[UserContext] Auth error:', error);
      setConnectionStatus('error');
      
      const friendlyMessage = getAuthErrorMessage(error);
      
      if (friendlyMessage.includes('timed out') || friendlyMessage.includes('timeout')) {
        throw new Error('Connection is slow. Please check your internet connection and try again. If the problem persists, try again later.');
      }
      
      throw new Error(friendlyMessage);
    }
  }, [triggerMigration]);

  const signOut = useCallback(async () => {
    console.log('[UserContext] === SIGN OUT START ===');
    if (currentUser?.id) {
      logAuditEvent({ eventType: 'auth.sign_out', userId: currentUser.id });
    }
    setIsLoading(true);
    try {
      setCurrentUser(null);
      setUsers([]);
      setHasCompletedOnboarding(false);
      setConnectionStatus('idle');
      setRetryCount(0);
      console.log('[UserContext] State cleared immediately');

      queryClient.cancelQueries();
      queryClient.removeQueries();
      queryClient.clear();
      console.log('[UserContext] Query cache cleared');

      const keysToRemove = [
        CACHED_AUTH_KEY,
        ONBOARDING_KEY,
        USER_ACTIVITY_KEY,
        '@allergy_guardian_offline_products',
        'manual_ingredient_entries',
        '@allergy_guardian_admin_settings',
        '@allergy_guardian_search_history',
        '@allergy_guardian_shopping_list',
        '@allergy_guardian_favorites',
      ];

      await Promise.all(
        keysToRemove.map(key =>
          AsyncStorage.removeItem(key).catch(() =>
            console.log('[UserContext] Non-critical: failed to remove', key)
          )
        )
      );
      console.log('[UserContext] AsyncStorage keys cleared');

      await supabase.auth.signOut();
      console.log('[UserContext] === SIGN OUT COMPLETE ===');
    } catch (error) {
      console.error('[UserContext] Error during sign out:', error);
      setCurrentUser(null);
      setHasCompletedOnboarding(false);
      setConnectionStatus('idle');
      queryClient.clear();
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    } finally {
      setIsLoading(false);
    }
  }, [queryClient, currentUser]);

  const completeOnboarding = useCallback(async () => {
    console.log('Setting onboarding as complete...');
    setHasCompletedOnboarding(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      console.log('Onboarding saved to local storage successfully');
      
      if (currentUser?.id) {
        console.log('[UserContext] Syncing onboarding status to Supabase...');
        const { error } = await supabase
          .from('users')
          .update({ 
            settings: { onboarding_complete: true, notifications: true, autoSync: true, theme: 'auto' }
          })
          .eq('id', currentUser.id);
        
        if (error) {
          console.error('[UserContext] Failed to sync onboarding to Supabase:', error);
        } else {
          console.log('[UserContext] Onboarding status synced to Supabase');
        }
      }
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
    console.log('Onboarding marked as complete');
  }, [currentUser?.id]);

  const clearAllData = useCallback(async () => {
    try {
      console.log('Clearing all user data...');
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      setHasCompletedOnboarding(false);
      console.log('All user data cleared');
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  }, []);

  const resetApp = useCallback(async () => {
    try {
      console.log('[UserContext] RESETTING APP - Clearing all data...');
      
      await AsyncStorage.clear();
      await supabase.auth.signOut();
      
      setCurrentUser(null);
      setUsers([]);
      setHasCompletedOnboarding(false);
      
      console.log('[UserContext] APP RESET COMPLETE - All data cleared');
    } catch (error) {
      console.error('[UserContext] Error resetting app:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      throw new Error(`Failed to reset app: ${errorMessage}`);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      console.log('Resetting password for:', email);
      throw new Error('Password reset via this method is not supported. Please use the forgot password flow.');
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }, []);

  const checkUserExists = useCallback(async (email: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      return !!data;
    } catch {
      return false;
    }
  }, []);

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    try {
      console.log('Updating user:', userId);
      
      const supabaseUpdates: any = {};
      if (updates.email !== undefined) supabaseUpdates.email = updates.email;
      if (updates.isAdmin !== undefined) supabaseUpdates.is_admin = updates.isAdmin;

      await supabase
        .from('users')
        .update(supabaseUpdates)
        .eq('id', userId);
      
      if (currentUser && currentUser.id === userId) {
        setCurrentUser({ ...currentUser, ...updates });
      }

      const { data: allUsers } = await supabase.from('users').select('*');
      if (allUsers) {
        const mappedUsers: User[] = allUsers.map(u => ({
          id: u.id,
          email: u.email,
          isAdmin: u.is_admin || false,
          createdAt: u.created_at,
        }));
        setUsers(mappedUsers);
      }
      
      console.log('User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [currentUser]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      console.log('Deleting user:', userId);
      
      await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (currentUser && currentUser.id === userId) {
        await signOut();
      }

      const { data: allUsers } = await supabase.from('users').select('*');
      if (allUsers) {
        const mappedUsers: User[] = allUsers.map(u => ({
          id: u.id,
          email: u.email,
          isAdmin: u.is_admin || false,
          createdAt: u.created_at,
        }));
        setUsers(mappedUsers);
      }
      
      console.log('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }, [currentUser, signOut]);

  const refreshUsers = useCallback(async () => {
    try {
      console.log('Refreshing users...');
      const { data: allUsers } = await supabase.from('users').select('*');
      if (allUsers) {
        const mappedUsers: User[] = allUsers.map(u => ({
          id: u.id,
          email: u.email,
          isAdmin: u.is_admin || false,
          createdAt: u.created_at,
        }));
        setUsers(mappedUsers);
      }
      console.log('Users refreshed');
    } catch (error) {
      console.error('Error refreshing users:', error);
      throw error;
    }
  }, []);

  const trackActivity = useCallback(async (activityType: string, metadata?: Record<string, any>) => {
    if (!currentUser) return;
    
    try {
      const { Platform } = await import('react-native');
      
      const sanitizedMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : undefined;
      
      const activity = {
        userId: currentUser.id,
        userEmail: currentUser.email,
        type: activityType,
        metadata: sanitizedMetadata,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
      };
      
      console.log('[UserContext] Tracking activity:', activityType);
      
      let activities: any[] = [];
      try {
        const existingActivities = await AsyncStorage.getItem(USER_ACTIVITY_KEY);
        if (existingActivities) {
          const parsed = JSON.parse(existingActivities);
          if (Array.isArray(parsed)) {
            activities = parsed;
          } else {
            console.warn('[UserContext] Activity storage was not an array, resetting');
            activities = [];
          }
        }
      } catch (parseError) {
        console.warn('[UserContext] Failed to parse existing activities, resetting:', parseError);
        activities = [];
        await AsyncStorage.removeItem(USER_ACTIVITY_KEY).catch(() => {});
      }
      
      activities.unshift(activity);
      if (activities.length > 100) activities.splice(100);
      
      try {
        await AsyncStorage.setItem(USER_ACTIVITY_KEY, JSON.stringify(activities));
      } catch (saveError) {
        console.warn('[UserContext] Failed to save activities:', saveError);
      }
      
      Promise.resolve(supabase.from('user_activity').insert({
        user_id: currentUser.id,
        activity_type: activityType,
        metadata: sanitizedMetadata,
        created_at: new Date().toISOString(),
      })).catch(() => {});
    } catch (error) {
      console.warn('[UserContext] Error tracking activity (non-critical):', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [currentUser]);

  const getRecentActivities = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(USER_ACTIVITY_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.warn('[UserContext] Activities data was not an array, returning empty');
        return [];
      }
      return parsed;
    } catch (error) {
      console.warn('[UserContext] Failed to parse activities:', error instanceof Error ? error.message : 'Unknown');
      AsyncStorage.removeItem(USER_ACTIVITY_KEY).catch(() => {});
      return [];
    }
  }, []);

  return useMemo(() => ({
    currentUser,
    users,
    isLoading,
    hasCompletedOnboarding,
    connectionStatus,
    retryCount,
    signIn,
    signOut,
    completeOnboarding,
    clearAllData,
    resetApp,
    resetPassword,
    checkUserExists,
    updateUser,
    deleteUser,
    refreshUsers,
    trackActivity,
    getRecentActivities,
  }), [currentUser, users, isLoading, hasCompletedOnboarding, connectionStatus, retryCount, signIn, signOut, completeOnboarding, clearAllData, resetApp, resetPassword, checkUserExists, updateUser, deleteUser, refreshUsers, trackActivity, getRecentActivities]);
});
