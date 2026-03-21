import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useBookImport } from '@/hooks/useBookImport';
import { useTheme } from '@/contexts/ThemeContext';

export default function HeaderUploadButton() {
  const { isImporting, importBook } = useBookImport();
  const { colors } = useTheme();

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await importBook();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isImporting}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityLabel="Import EPUB book"
      accessibilityRole="button"
      hitSlop={8}
    >
      {isImporting ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Ionicons name="add" size={26} color={colors.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 4,
    padding: 4,
  },
  pressed: {
    opacity: 0.5,
  },
});
