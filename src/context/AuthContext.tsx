import type {Session} from '@supabase/supabase-js';
import type {ReactNode} from 'react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {supabase} from '../config/supabase';
import type {Profile} from '../types/domain';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  hasAnyAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  updateProfile: (values: Partial<Profile>) => Promise<void>;
  claimFirstAdmin: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAnyAdmin, setHasAnyAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      setIsAdmin(false);
      setHasAnyAdmin(false);
      return;
    }

    const [{data: profileData}, {data: roleData}, {count}] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', nextSession.user.id)
        .eq('role', 'admin')
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role', {count: 'exact', head: true})
        .eq('role', 'admin'),
    ]);

    setProfile((profileData as Profile | null) ?? null);
    setIsAdmin(Boolean(roleData));
    setHasAnyAdmin((count ?? 0) > 0);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({data}) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      await loadAccount(data.session);
      setLoading(false);
    });

    const {data: listener} = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadAccount(nextSession).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const refreshAccount = useCallback(async () => {
    await loadAccount(session);
  }, [loadAccount, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const {error} = await supabase.auth.signInWithPassword({email, password});
    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const {data, error} = await supabase.auth.signUp({email, password});
    if (error) {
      throw error;
    }

    return data.session
      ? null
      : 'Check your email to confirm the account, then sign in.';
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async (values: Partial<Profile>) => {
      if (!session?.user) {
        throw new Error('Not signed in');
      }

      const {error} = profile
        ? await supabase
            .from('profiles')
            .update(values)
            .eq('id', session.user.id)
        : await supabase.from('profiles').insert({
            id: session.user.id,
            ...values,
          });

      if (error) {
        throw error;
      }

      await refreshAccount();
    },
    [profile, refreshAccount, session?.user],
  );

  const claimFirstAdmin = useCallback(async () => {
    const {error} = await supabase.rpc('claim_first_admin');
    if (error) {
      throw error;
    }

    await refreshAccount();
  }, [refreshAccount]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isAdmin,
      hasAnyAdmin,
      signIn,
      signUp,
      signOut,
      refreshAccount,
      updateProfile,
      claimFirstAdmin,
    }),
    [
      session,
      profile,
      loading,
      isAdmin,
      hasAnyAdmin,
      signIn,
      signUp,
      signOut,
      refreshAccount,
      updateProfile,
      claimFirstAdmin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
