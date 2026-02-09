import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { BooksProvider } from '@/contexts/BooksContext';
import { initDatabase } from '@/utils/database';
import { ensureStorageDirs } from '@/utils/epub/metadata';

function RootNavigator() {
  const { isDark, colors } = useTheme();

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
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
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
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
