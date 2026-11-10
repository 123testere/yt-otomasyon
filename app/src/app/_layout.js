import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { registerForPush } from '../lib/push';
import { colors, Screen } from '../components/ui';

function Gate() {
  const { user, isAdmin, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login';
    if (!user && !onLogin) router.replace('/login');
    if (user && onLogin) router.replace('/');
  }, [user, loading, segments]);

  useEffect(() => {
    if (isAdmin) registerForPush().catch(() => {});
  }, [isAdmin]);

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="sosyal/[id]" options={{ title: 'Kanal' }} />
      <Stack.Screen name="kesif/[id]" options={{ title: 'Fırsat' }} />
      <Stack.Screen name="istatistik" options={{ title: 'İstatistik' }} />
      <Stack.Screen name="optimizasyon" options={{ title: 'Optimizasyon' }} />
      <Stack.Screen name="kurulum" options={{ title: 'Yeni kanal' }} />
      <Stack.Screen name="channel/[id]" options={{ title: 'Kanal ayarları' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
