import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { Book } from '@/types/book';
import { Spacing } from '@/constants/layout';
import Slider from '@/components/Slider';
import ChapterListModal from '@/components/ChapterListModal';

interface ReaderControlsProps {
  visible: boolean;
  book: Book;
  currentPage: number;
  totalPages: number;
  chapterIndex: number;
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
  onBack,
  onDismiss,
  onGoToPage,
  onSelectChapter,
}: ReaderControlsProps) {
  const insets = useSafeAreaInsets();
  const [chapterListVisible, setChapterListVisible] = useState(false);

  if (!visible) return null;

  const chapterTitle =
    book.spine[chapterIndex]?.id ?? `Chapter ${chapterIndex + 1}`;

  return (
    <>
      <Animated.View
        style={styles.overlay}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
      >
        {/* Tappable backdrop to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        {/* Top bar */}
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + Spacing.xs },
          ]}
        >
          <Pressable
            style={styles.iconButton}
            onPress={onBack}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {book.title}
            </Text>
            <Text style={styles.chapterText} numberOfLines={1}>
              {chapterTitle}
            </Text>
          </View>

          {/* Chapter list button */}
          <Pressable
            style={styles.iconButton}
            onPress={() => setChapterListVisible(true)}
            hitSlop={12}
          >
            <Ionicons name="list" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Bottom bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + Spacing.sm },
          ]}
        >
          <View style={styles.progressRow}>
            <Text style={styles.pageText}>
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
              style={styles.slider}
              disabled={totalPages <= 1}
            />
            <Text style={styles.pageText}>
              {totalPages}
            </Text>
          </View>
          <Text style={styles.chapterCountText}>
            Chapter {chapterIndex + 1} of {book.spine.length}
          </Text>
        </View>
      </Animated.View>

      {/* Chapter list modal */}
      <ChapterListModal
        visible={chapterListVisible}
        spine={book.spine}
        currentChapterIndex={chapterIndex}
        onSelectChapter={(idx) => {
          setChapterListVisible(false);
          onSelectChapter(idx);
        }}
        onClose={() => setChapterListVisible(false)}
      />
    </>
  );
}

export default memo(ReaderControls);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chapterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  slider: {
    flex: 1,
  },
  pageText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 28,
    textAlign: 'center',
  },
  chapterCountText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
