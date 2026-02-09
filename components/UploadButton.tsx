import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBookImport } from '@/hooks/useBookImport';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Floating action button for importing EPUB files.
 * Positioned above the native tab bar in the bottom-right corner.
 * Uses a simple semi-transparent background on Android (GlassCard.ios.tsx
 * provides the native glass effect on iOS via platform resolution).
 */
export default function UploadButton() {
  const { isImporting, error, importBook } = useBookImport();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await importBook();
  };

  // Position above the native tab bar: safe area bottom + tab bar height (~49pt) + margin
  const bottomOffset = insets.bottom + 49 + 16;

  return (
    <>
      {error && (
        <View
          className="absolute left-md right-md p-sm rounded-app-md bg-danger dark:bg-danger-dark"
          style={{ bottom: bottomOffset + 64 }}
        >
          <Text className="text-white text-sm text-center">{error}</Text>
        </View>
      )}
      <Pressable
        // StyleSheet kept: shadow properties, dynamic bottom offset
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomOffset, right: 20 },
          pressed && styles.fabPressed,
        ]}
        onPress={handlePress}
        disabled={isImporting}
        accessibilityLabel="Import EPUB book"
        accessibilityRole="button"
      >
        {isImporting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name="add" size={28} color={isDark ? '#FFFFFF' : '#000000'} />
        )}
      </Pressable>
    </>
  );
}

// StyleSheet kept: shadow, absolute positioning, transform
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
