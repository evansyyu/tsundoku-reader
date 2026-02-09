/**
 * Chapters formSheet modal route.
 *
 * Displays the book's spine as a scrollable chapter list.
 * Presented as a native formSheet on iOS for Liquid Glass support.
 *
 * Route: /chapters/:id?chapter=<currentIndex>
 */
import React, { useCallback, useMemo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useBooks } from '@/contexts/BooksContext';
import { useTheme } from '@/contexts/ThemeContext';
import { notifyChapterSelected } from '@/utils/chapterSelection';
import type { SpineItem } from '@/types/book';

const ITEM_HEIGHT = 52;

/** Attempt to produce a human-readable chapter name from the spine ID / href */
function formatChapterName(id: string, index: number): string {
  let name = id.replace(/\.[^.]+$/, '').replace(/.*\//, '');
  name = name.replace(/[_-]/g, ' ');
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name || `Chapter ${index + 1}`;
}

export default function ChaptersScreen() {
  const { id, chapter } = useLocalSearchParams<{ id: string; chapter?: string }>();
  const { getBook } = useBooks();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const glassAvailable = isLiquidGlassAvailable();

  const book = getBook(id ?? '');
  const currentChapterIndex = chapter ? parseInt(chapter, 10) : 0;

  const handleSelect = useCallback(
    (index: number) => {
      notifyChapterSelected(index);
      router.back();
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SpineItem; index: number }) => {
      const isCurrent = index === currentChapterIndex;
      return (
        <Pressable
          style={[
            styles.row,
            { borderBottomColor: colors.border },
            isCurrent && { backgroundColor: colors.tint + '14' },
          ]}
          onPress={() => handleSelect(index)}
        >
          <Text
            style={[
              styles.label,
              { color: isCurrent ? colors.tint : colors.text },
              isCurrent && styles.bold,
            ]}
            numberOfLines={1}
          >
            {formatChapterName(item.id, index)}
          </Text>
          <Text
            style={[
              styles.index,
              { color: isCurrent ? colors.tint : colors.textSecondary },
              isCurrent && styles.bold,
            ]}
          >
            {index + 1}
          </Text>
        </Pressable>
      );
    },
    [currentChapterIndex, handleSelect, colors]
  );

  const keyExtractor = useCallback((item: SpineItem) => item.id, []);

  if (!book) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Book not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Chapters',
          headerLeft: () =>
            Platform.OS === 'ios' ? (
              <Pressable onPress={() => router.back()} hitSlop={12} className="">
                <Ionicons
                  name="close-outline"
                  size={36}
                  color={isDark ? '#FFFFFF' : '#8E8E93'}
                />
              </Pressable>
            ) : undefined,
        }}
      />
      <FlatList
        style={{
          flex: 1,
          backgroundColor: glassAvailable ? 'transparent' : colors.background,
        }}
        contentInsetAdjustmentBehavior="automatic"
        data={book.spine}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={
          currentChapterIndex > 4 ? currentChapterIndex - 2 : 0
        }
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 48,
  },
  row: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  index: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  bold: {
    fontWeight: '600',
  },
});
