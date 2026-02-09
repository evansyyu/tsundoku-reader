/**
 * Search tab Stack layout.
 *
 * Enables the native iOS large-title header that collapses into a
 * compact translucent bar on scroll. Uses Liquid Glass on iOS 26+
 * and UIVisualEffectView blur on older iOS versions.
 *
 * The native headerSearchBar is configured from SearchScreen via
 * <Stack.Screen> so the screen owns the search query state.
 */
import { DynamicColorIOS, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '@/contexts/ThemeContext';

export default function SearchLayout() {
  const glassAvailable = isLiquidGlassAvailable();
  const { isDark, colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerBlurEffect: glassAvailable ? undefined : isDark ? 'dark' : 'light',
        ...(Platform.OS === 'ios' && {
          headerTintColor: DynamicColorIOS({ dark: 'white', light: 'black' }) as unknown as string,
        }),
        headerLargeStyle: {
          backgroundColor: glassAvailable ? 'transparent' : colors.background,
        },
        headerStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Search' }}
      />
    </Stack>
  );
}
