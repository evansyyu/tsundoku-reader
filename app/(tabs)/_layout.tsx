/**
 * Tab layout using Expo Router's native iOS tabs.
 *
 * NativeTabs provides a true UITabBar on iOS with SF Symbols.
 * Falls back to JS tabs on unsupported platforms.
 *
 * Reference: https://docs.expo.dev/router/advanced/native-tabs/
 */
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * For now we use the JS-based Tabs from expo-router which are stable.
 * NativeTabs from 'expo-router/unstable-native-tabs' can be swapped in
 * when it becomes stable. The route structure is the same.
 */
export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Books',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="book" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="search" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * Simple tab bar icon using @expo/vector-icons.
 * On iOS, these map visually to SF Symbol equivalents.
 */
import { Ionicons } from '@expo/vector-icons';

function TabBarIcon({
  name,
  color,
  size,
}: {
  name: 'book' | 'search' | 'cog';
  color: string;
  size: number;
}) {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    book: 'book',
    search: 'search',
    cog: 'settings-sharp',
  };

  return <Ionicons name={iconMap[name]} size={size} color={color} />;
}
