/**
 * Settings tab Stack layout.
 *
 * Enables the native iOS large-title header that collapses into a
 * compact translucent bar on scroll. Uses Liquid Glass on iOS 26+
 * and UIVisualEffectView blur on older iOS versions.
 *
 * IMPORTANT: Do NOT use headerTransparent here. The large title collapse
 * is driven by UINavigationBar's built-in scroll tracking, which requires
 * the bar to be in its standard (non-transparent) layout mode.
 * headerBlurEffect independently handles the compact header's translucency.
 */
import { DynamicColorIOS, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsLayout() {
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
        options={{ title: 'Settings' }}
      />
    </Stack>
  );
}
