import createContextHook from '@nkzw/create-context-hook';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { migrateToSupabase, checkMigrationStatus } from '@/utils/supabaseMigration';
import { withTimeout, withRetry, getAuthErrorMessage } from '@/utils/authTimeout';

const ONBOARDING_KEY = '@allergy_guardian_onboarding_complete';
const CACHED_AUTH_KEY = '@allergy_guardian_cached_auth';
const USER_ACTIVITY_KEY = '@allergy_guardian_user_activity';
const AUTH_TIMEOUT = 18000; // 18 seconds - very forgiving for slow connections
const SESSION_TIMEOUT = 12000; // 12 seconds for initial session check
const ADMIN_EMAILS = [
  'eazypeezytechnologies@gmail.com',
  // Add more admin emails here if needed
];

export const [UserProvider, useUser] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'slow' | 'error' | 'idle'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const queryClient = useQueryClient();
  

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
    let slowConnectionTimer: ReturnType<typeof setTimeout>;

    const loadData = async () => {
      try {
        if (__DEV__) console.log('[UserContext] Loading user session...');
        setConnectionStatus('connecting');
        
        slowConnectionTimer = setTimeout(() => {
          setConnectionStatus('slow');
        }, 3000);
        
        const [onboarding, cachedAuth] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(CACHED_AUTH_KEY),
        ]);
        setHasCompletedOnboarding(onboarding === 'true');

        if (cachedAuth) {
          try {
            const cached = JSON.parse(cachedAuth);
            if (cached.email && cached.id) {
              if (__DEV__) console.log('[UserContext] Using cached auth for instant startup');
              const cachedUser: User = {
                id: cached.id,
                email: cached.email,
                isAdmin: cached.isAdmin || false,
                createdAt: cached.createdAt,
              };
              setCurrentUser(cachedUser);
            }
          } catch {
            if (__DEV__) console.log('[UserContext] Failed to parse cached auth');
          }
        }

        let sessionResult;
        try {
          sessionResult = await withTimeout(
            supabase.auth.getSession(),
            SESSION_TIMEOUT,
            'Session check timed out'
          );
        } catch {
          if (__DEV__) console.log('[UserContext] Session check timed out or failed, using cached auth if available');
          clearTimeout(slowConnectionTimer);
          
          // If we have cached auth, use it and proceed
          const cachedAuth = await AsyncStorage.getItem(CACHED_AUTH_KEY);
          if (cachedAuth) {
            try {
              const cached = JSON.parse(cachedAuth);
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
        
        clearTimeout(slowConnectionTimer);
        const session = sessionResult.data.session;
        
        if (session?.user) {
          if (__DEV__) console.log('[UserContext] Found active session:', session.user.email);
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

          // Check if user has completed onboarding from Supabase settings
          // Use local variable 'onboarding' instead of state to avoid dependency issues
          const serverOnboardingComplete = userData?.settings?.onboarding_complete === true;
          const localOnboardingComplete = onboarding === 'true';
          
          // For returning users: if they have a user record in database, they've completed onboarding
          // This handles cases where settings might not have onboarding_complete set
          const isReturningUser = userData !== null && userData !== undefined;
          
          if ((serverOnboardingComplete || isReturningUser) && !localOnboardingComplete) {
            console.log('[UserContext] Restoring onboarding status for returning user - hasUserData:', isReturningUser, 'serverFlag:', serverOnboardingComplete);
            setHasCompletedOnboarding(true);
            AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
            
            // Also update server settings if not already set
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
      clearTimeout(slowConnectionTimer);
      authListener.subscription.unsubscribe();
    };
  }, [triggerMigration]);

  const signIn = useCallback(async (email: string, password: string, isSignup: boolean = false) => {
    setConnectionStatus('connecting');
    setRetryCount(0);
    
    try {
      console.log(isSignup ? 'Creating account:' : 'Signing in:', email);
      
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
          
          // Non-blocking DB insert
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
        }
      } else {
        const { data, error } = await withRetry(
          () => supabase.auth.signInWithPassword({ email, password }),
          {
            timeout: AUTH_TIMEOUT,
            maxRetries: 2,
            retryDelay: 2000,
            onRetry: (attempt) => {
              setRetryCount(attempt);
              setConnectionStatus('slow');
              if (__DEV__) console.log(`[UserContext] Sign-in retry attempt ${attempt}`);
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
          
          // First check database for existing admin status (with timeout, non-blocking for user)
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
          
          // Admin if email matches OR already admin in database
          const finalIsAdmin = isAdminByEmail || (userData?.is_admin === true);
          
          const user: User = {
            id: data.user.id,
            email: email,
            isAdmin: finalIsAdmin,
            createdAt: data.user.created_at,
          };

          // Non-blocking DB operations
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
          
          // ALWAYS set onboarding complete for sign-in (not signup)
          // If user can sign in, they've already completed signup before
          console.log('[signIn] User signed in successfully, marking onboarding complete');
          setHasCompletedOnboarding(true);
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          
          // Cache auth for faster subsequent loads
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
      
      // Convert to user-friendly message
      const friendlyMessage = getAuthErrorMessage(error);
      
      // For timeout errors, provide more helpful guidance
      if (friendlyMessage.includes('timed out') || friendlyMessage.includes('timeout')) {
        throw new Error('Connection is slow. Please check your internet connection and try again. If the problem persists, try again later.');
      }
      
      throw new Error(friendlyMessage);
    }
  }, [triggerMigration]);

  const signOut = useCallback(async () => {
    console.log('Signing out...');
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem(CACHED_AUTH_KEY);
      
      queryClient.removeQueries({ queryKey: ['supabase-profiles'] });
      queryClient.removeQueries({ queryKey: ['supabase-user-settings'] });
      queryClient.removeQueries({ queryKey: ['supabase-scan-history'] });
      queryClient.removeQueries({ queryKey: ['supabase-favorites'] });
      queryClient.removeQueries({ queryKey: ['supabase-shopping-list'] });
      queryClient.removeQueries({ queryKey: ['supabase-family-groups'] });
      console.log('[UserContext] Cleared all query caches on logout');
      
      await supabase.auth.signOut();
      setCurrentUser(null);
      console.log('Sign out complete');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const completeOnboarding = useCallback(async () => {
    console.log('Setting onboarding as complete...');
    setHasCompletedOnboarding(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      console.log('Onboarding saved to local storage successfully');
      
      // Also save to Supabase so returning users don't have to re-onboard
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
      console.log('🔄 RESETTING APP - Clearing all data...');
      
      await AsyncStorage.clear();
      await supabase.auth.signOut();
      
      setCurrentUser(null);
      setUsers([]);
      setHasCompletedOnboarding(false);
      
      console.log('✅ APP RESET COMPLETE - All data cleared');
    } catch (error) {
      console.error('❌ Error resetting app:', error);
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
      const activity = {
        userId: currentUser.id,
        userEmail: currentUser.email,
        type: activityType,
        metadata,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
      };
      
      console.log('[UserContext] Tracking activity:', activityType);
      
      // Store locally for admin monitor
      const existingActivities = await AsyncStorage.getItem(USER_ACTIVITY_KEY);
      const activities = existingActivities ? JSON.parse(existingActivities) : [];
      activities.unshift(activity);
      // Keep only last 100 activities
      if (activities.length > 100) activities.splice(100);
      await AsyncStorage.setItem(USER_ACTIVITY_KEY, JSON.stringify(activities));
      
      // Also try to sync to Supabase if online
      try {
        await supabase.from('user_activity').insert({
          user_id: currentUser.id,
          activity_type: activityType,
          metadata,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Silently fail - activity tracking is non-critical
      }
    } catch (error) {
      console.error('[UserContext] Error tracking activity:', error);
    }
  }, [currentUser]);

  const getRecentActivities = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(USER_ACTIVITY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
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
