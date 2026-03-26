import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function Layout() {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<any>(undefined);
  const [isRecovery, setIsRecovery] = useState(false);

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
    const publicRoutes = ['index', 'forgot-password', 'reset-password'];
    const onPublicRoute = segments[0] === undefined || publicRoutes.includes(segments[0]);
    if (!session && !onPublicRoute) {
      router.replace('/');
    } else if (session && onPublicRoute) {
      router.replace('/dashboard');
    }
  }, [session, segments, isRecovery]);

  if (session === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#2C4A35', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#C9A85C" size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
