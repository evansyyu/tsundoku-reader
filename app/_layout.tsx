import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { BooksProvider } from '@/contexts/BooksContext';
import { initDatabase } from '@/utils/database';
import { ensureStorageDirs } from '@/utils/epub/metadata';

function RootNavigator() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const glassAvailable = isLiquidGlassAvailable();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="reader/[id]"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="chapters/[id]"
          options={{
            presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.7],
            headerShown: true,
            headerLargeTitle: false,
            title: 'Chapters',
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: glassAvailable ? undefined : isDark ? 'dark' : 'light',
            headerStyle: {
              backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background,
            },
            contentStyle: {
              backgroundColor: glassAvailable ? 'transparent' : colors.background,
            },
            headerLeft: () =>
              Platform.OS === 'ios' ? (
                <Pressable onPress={() => router.back()} hitSlop={12}>
                  <Ionicons
                    name="close-circle"
                    size={28}
                    color={isDark ? '#FFFFFF' : '#8E8E93'}
                  />
                </Pressable>
              ) : undefined,
          }}
        />
      </Stack>
    </>
  );
}

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize database and storage directories in parallel
        await Promise.all([initDatabase(), ensureStorageDirs()]);
      } catch (error) {
        console.error('[App] Initialization failed:', error);
      } finally {
        setIsReady(true);
      }
    }

    initialize();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <BooksProvider>
      <RootNavigator />
    </BooksProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <ThemeProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
