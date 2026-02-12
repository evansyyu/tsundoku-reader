import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { BooksProvider, useBooks } from '@/contexts/BooksContext';
import { initDatabase } from '@/utils/database';
import { initDictionaryDatabase } from '@/utils/dictionary';
import { ensureStorageDirs } from '@/utils/epub/metadata';
import { mmkv } from '@/utils/storage';
import { ACTIVE_BOOK_KEY } from '@/screens/ReaderScreen';

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
            headerTintColor: isDark ? '#FFFFFF' : '#000000',
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
                    name="close-outline"
                    size={36}
                    color={isDark ? '#FFFFFF' : '#8E8E93'}
                  />
                </Pressable>
              ) : undefined,
          }}
        />
        <Stack.Screen
          name="dictionary/[term]"
          options={{
            presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.5, 0.85],
            headerShown: true,
            headerLargeTitle: false,
            title: '',
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
                    name="close-outline"
                    size={36}
                    color={isDark ? '#FFFFFF' : '#8E8E93'}
                  />
                </Pressable>
              ) : undefined,
          }}
        />
        <Stack.Screen
          name="reader-settings"
          options={{
            presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.7],
            headerShown: true,
            headerLargeTitle: false,
            title: 'Settings',
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: glassAvailable ? undefined : isDark ? 'dark' : 'light',
            headerTintColor: isDark ? '#FFFFFF' : '#000000',
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
                    name="close-outline"
                    size={36}
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

/**
 * Restores the reader session when the app relaunches after being killed
 * while a book was open. Runs once after books finish loading.
 */
function ActiveBookRestore() {
  const router = useRouter();
  const { books, isLoading } = useBooks();
  const checked = useRef(false);

  useEffect(() => {
    if (isLoading || checked.current) return;
    checked.current = true;

    const activeId = mmkv.getString(ACTIVE_BOOK_KEY);
    if (!activeId) return;

    const exists = books.some((b) => b.id === activeId);
    if (exists) {
      // Push the reader on top of the tabs so "back" returns to the library
      setTimeout(() => router.push(`/reader/${activeId}`), 0);
    } else {
      // Book was deleted; clear stale reference
      mmkv.delete(ACTIVE_BOOK_KEY);
    }
  }, [isLoading, books, router]);

  return null;
}

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize databases and storage directories in parallel
        // Dictionary init is non-critical -- don't block app if it fails
        await Promise.all([
          initDatabase(),
          initDictionaryDatabase().catch(() => {}),
          ensureStorageDirs(),
        ]);
      } catch {
        // initialization failed
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
      <ActiveBookRestore />
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
