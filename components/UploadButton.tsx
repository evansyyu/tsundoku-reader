import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useBookImport } from '@/hooks/useBookImport';
import { BorderRadius, Spacing } from '@/constants/layout';

/**
 * Floating action button for importing EPUB files.
 */
export default function UploadButton() {
  const { colors } = useTheme();
  const { isImporting, error, importBook } = useBookImport();

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await importBook();
  };

  return (
    <>
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.danger }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.tint },
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
          <Ionicons name="add" size={28} color="#FFFFFF" />
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  errorBanner: {
    position: 'absolute',
    bottom: 96,
    left: Spacing.md,
    right: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});
