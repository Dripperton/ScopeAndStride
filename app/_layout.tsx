import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator, Text, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1A1A1A', padding: 40, paddingTop: 100 }}>
          <Text style={{ color: '#FF6B6B', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>App Error</Text>
          <ScrollView>
            <Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20 }}>{this.state.error.message}</Text>
            <Text style={{ color: '#888', fontSize: 11, marginTop: 12, lineHeight: 16 }}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

import { LanguageProvider } from '../lib/LanguageContext';
import { ThemeProvider, HHF_THEME } from '../context/ThemeContext';
import { ProfileProvider } from '../lib/useProfile';

export default function Layout() {
  const router = useRouter();
  const [session, setSession] = useState<any>(undefined);
  const [isRecovery, setIsRecovery] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setSession(session);
        return;
      }
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        hasRedirected.current = false;
      }
      setIsRecovery(false);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (isRecovery) {
      router.replace('/reset-password');
      return;
    }

    if (!session) {
      hasRedirected.current = false;
      router.replace('/');
      return;
    }

    // Only redirect once per session — don't re-run on every navigation
    if (session && !hasRedirected.current) {
      hasRedirected.current = true;
      (async () => {
        const email = session.user.email?.toLowerCase();

        // Check for a pending invite first — regardless of whether a profile exists
        // (a DB trigger may have already created a profile with a default role)
        const { data: invite } = await supabase
          .from('invites')
          .select('*')
          .eq('email', email)
          .eq('accepted', false)
          .single();

        if (invite) {
          // Map legacy 'rider' role to 'horse_owner'
          const role = invite.role === 'rider' ? 'horse_owner' : invite.role;

          // Upsert profile with the correct role from the invite
          await supabase.from('profiles').upsert({
            id: session.user.id,
            email,
            full_name: '',
            role,
            barn_id: 'default',
            onboarding_complete: true, // invited users already have horse assigned
          });

          // Create horse link if applicable and not already linked
          if (role === 'horse_owner' && invite.horse_id) {
            const { data: existingLink } = await supabase
              .from('horse_users')
              .select('id')
              .eq('horse_id', invite.horse_id)
              .eq('user_id', session.user.id)
              .single();

            if (!existingLink) {
              await supabase.from('horse_users').insert({
                horse_id: invite.horse_id,
                user_id: session.user.id,
                relationship: invite.relationship || 'owner',
                billing_contact: invite.billing_contact || false,
              });
            }
          }

          await supabase.from('invites').update({ accepted: true }).eq('id', invite.id);
          router.replace('/dashboard');
          return;
        }

        // No pending invite — normal role-based routing
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, onboarding_complete')
          .eq('id', session.user.id)
          .single();

        if (
          profile?.role === 'horse_owner' &&
          profile?.onboarding_complete === false
        ) {
          router.replace('/onboarding');
        } else {
          router.replace('/dashboard');
        }
      })();
    }
  }, [session, isRecovery]);

  if (session === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2B5FD9" size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider primary={HHF_THEME.primary} secondary={HHF_THEME.secondary} surface={HHF_THEME.surface}>
          <LanguageProvider>
            <ProfileProvider>
                <Stack screenOptions={{ headerShown: false }} />
            </ProfileProvider>
          </LanguageProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
