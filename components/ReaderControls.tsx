import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { Book } from '@/types/book';
import type { ViewMode } from '@/types/settings';
import { Spacing } from '@/constants/layout';
import Slider from '@/components/Slider';

const AUTO_DISMISS_MS = 2000;

interface ReaderControlsProps {
  visible: boolean;
  book: Book;
  currentPage: number;
  totalPages: number;
  chapterIndex: number;
  viewMode: ViewMode;
  onBack: () => void;
  onDismiss: () => void;
  onGoToPage: (page: number) => void;
  onSelectChapter: (index: number) => void;
}

/**
 * Overlay controls shown when user taps the center of the reader.
 * Includes back button, title, chapter list button, progress slider.
 */
function ReaderControls({
  visible,
  book,
  currentPage,
  totalPages,
  chapterIndex,
  viewMode,
  onBack,
  onDismiss,
  onGoToPage,
  onSelectChapter,
}: ReaderControlsProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
  }, [onDismiss]);

  // Start / restart timer whenever controls become visible
  useEffect(() => {
    if (visible) {
      resetTimer();
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, resetTimer]);

  if (!visible) return null;

  const chapterTitle =
    book.spine[chapterIndex]?.id ?? `Chapter ${chapterIndex + 1}`;

  return (
    <>
      <Animated.View
        // StyleSheet kept: absoluteFillObject spread for Reanimated
        style={styles.overlay}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
      >
        {/* Tappable backdrop to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        {/* Top bar - StyleSheet kept: paddingTop is dynamic safe area inset */}
        <View
          className="flex-row items-center px-md pb-sm bg-black/70 gap-md"
          style={{ paddingTop: insets.top + Spacing.xs }}
          onTouchStart={resetTimer}
        >
          <Pressable
            className="w-9 h-9 justify-center items-center"
            onPress={onBack}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View className="flex-1 items-center px-xs">
            <Text className="text-white text-base font-semibold" numberOfLines={1}>
              {book.title}
            </Text>
            <Text className="text-white/70 text-xs mt-0.5" numberOfLines={1}>
              {chapterTitle}
            </Text>
          </View>

          {/* Chapter list button */}
          <Pressable
            className="w-9 h-9 justify-center items-center"
            onPress={() => router.push(`/chapters/${book.id}?chapter=${chapterIndex}`)}
            hitSlop={12}
          >
            <Ionicons name="list" size={22} color="#FFFFFF" />
          </Pressable>

          {/* Settings button */}
          <Pressable
            className="w-9 h-9 justify-center items-center"
            onPress={() => router.push(`/reader-settings?bookId=${book.id}`)}
            hitSlop={12}
          >
            <Ionicons name="settings-sharp" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Bottom bar - StyleSheet kept: paddingBottom is dynamic safe area inset */}
        <View
          className="px-lg pt-md bg-black/70"
          style={{ paddingBottom: insets.bottom + Spacing.sm }}
          onTouchStart={resetTimer}
        >
          {viewMode === 'paginated' && (
            <View className="flex-row items-center gap-sm">
              <Text className="text-white text-[13px] font-medium min-w-[28px] text-center">
                {currentPage + 1}
              </Text>
              <Slider
                value={currentPage}
                minimumValue={0}
                maximumValue={Math.max(totalPages - 1, 0)}
                step={1}
                onValueChange={onGoToPage}
                tintColor="#FFFFFF"
                trackColor="rgba(255,255,255,0.3)"
                style={{ flex: 1 }}
                disabled={totalPages <= 1}
              />
              <Text className="text-white text-[13px] font-medium min-w-[28px] text-center">
                {totalPages}
              </Text>
            </View>
          )}
          <Text className="text-white/60 text-[11px] text-center mt-xs mb-xs">
            Chapter {chapterIndex + 1} of {book.spine.length}
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

export default memo(ReaderControls);

// StyleSheet kept: absoluteFillObject spread for Reanimated animated view
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 20,
  },
});
