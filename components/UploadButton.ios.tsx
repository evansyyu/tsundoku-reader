import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useBookImport } from '@/hooks/useBookImport';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * iOS-specific floating action button for importing EPUB files.
 * Uses GlassView (iOS 26+ Liquid Glass) or BlurView fallback.
 * Positioned above the native tab bar in the bottom-right corner.
 */
export default function UploadButton() {
  const { isImporting, error, importBook } = useBookImport();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const iconColor = isDark ? '#FFFFFF' : '#000000';

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await importBook();
  };

  // iPads have no tab bar home indicator; use a simple fixed offset.
  // iPhones: position above the native tab bar (safe area + ~49pt bar + margin).
  const isPad = (Platform as unknown as { isPad?: boolean }).isPad ?? false;
  const bottomOffset = isPad ? 20 : insets.bottom + 49 + 16;

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
      <View style={[
        styles.fabContainer,
        { bottom: bottomOffset, right: 20 },
        !isDark && styles.fabShadowLight,
      ]}>
        <GlassView style={styles.glassWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.fabInner,
              pressed && styles.fabPressed,
            ]}
            className="h-full items-center justify-center"
            onPress={handlePress}
            disabled={isImporting}
            accessibilityLabel="Import EPUB book"
            accessibilityRole="button"
          >
            {isImporting ? (
              <ActivityIndicator color={iconColor} />
            ) : (
              <Ionicons name="add" size={32} color={iconColor} />
            )}
          </Pressable>
        </GlassView>
      </View>
    </>
  );
}

/** BlurView wrapper matching GlassView's interface */
function BlurViewWrapper({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <BlurView intensity={60} tint="systemChromeMaterial" style={style}>
      {children}
    </BlurView>
  );
}

// StyleSheet kept: shadow, absolute positioning, glass container, transform
const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 9999,
    // No overflow:'hidden' here — it clips the shadow on iOS.
    // The inner glassWrap handles rounded clipping instead.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fabShadowLight: {
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  glassWrap: {
    flex: 1,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  fabInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
