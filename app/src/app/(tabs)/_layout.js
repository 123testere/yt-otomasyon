import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '../../components/ui';

const ikon = (sembol) => ({ color }) => <Text style={{ color, fontSize: 18, fontWeight: '900' }}>{sembol}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Özet', tabBarIcon: ikon('◉') }} />
      <Tabs.Screen name="kanallar" options={{ title: 'Kanallar', tabBarIcon: ikon('▦') }} />
      <Tabs.Screen name="videolar" options={{ title: 'Videolar', tabBarIcon: ikon('▶') }} />
      <Tabs.Screen name="rakipler" options={{ title: 'Rakipler', tabBarIcon: ikon('⚑') }} />
      <Tabs.Screen name="kesif" options={{ title: 'Keşif', tabBarIcon: ikon('✦') }} />
    </Tabs>
  );
}
