import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { Colors } from '@/constants/theme';
import { useLanguage } from '@/lib/i18n';

export default function TabLayout() {
  const { t } = useLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="forms"
        options={{
          title: t('tab.forms'),
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t('tab.services'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="locker"
        options={{
          title: t('tab.locker'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="lock-closed" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
