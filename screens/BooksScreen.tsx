import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
// SafeAreaView import kept for potential iOS <26 horizontal inset support
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBooks } from '@/contexts/BooksContext';
import BookCard from '@/components/BookCard';
import EmptyLibrary from '@/components/EmptyLibrary';
import UploadButton from '@/components/UploadButton';
import { useResponsiveGrid } from '@/hooks/useResponsiveGrid';
import type { Book } from '@/types/book';
import { GRID_GAP, GRID_PADDING } from '@/constants/layout';

const HALF_GAP = GRID_GAP / 2;

export default function BooksScreen() {
  const { colors } = useTheme();
  const { books, isLoading, removeBook } = useBooks();
  const router = useRouter();
  const { numColumns, itemWidth } = useResponsiveGrid(GRID_PADDING, GRID_GAP);

  const sortedBooks = useMemo(
    () =>
      [...books].sort((a, b) => {
        const aTime = a.lastReadAt ?? a.addedAt;
        const bTime = b.lastReadAt ?? b.addedAt;
        return bTime - aTime;
      }),
    [books]
  );

  const handleBookPress = useCallback(
    (book: Book) => {
      router.push(`/reader/${book.id}`);
    },
    [router]
  );

  const handleDeleteBook = useCallback(
    (book: Book) => {
      removeBook(book.id);
    },
    [removeBook]
  );

  const renderBookCard = useCallback(
    ({ item }: { item: Book }) => (
      <View style={[styles.cardWrapper, { width: itemWidth + HALF_GAP * 2 }]}>
        <BookCard
          book={item}
          width={itemWidth}
          onPress={() => handleBookPress(item)}
          onDelete={handleDeleteBook}
        />
      </View>
    ),
    [handleBookPress, handleDeleteBook, itemWidth]
  );

  const keyExtractor = useCallback((item: Book) => item.id, []);

  /*
   * FlatList is the topmost returned element so that react-native-screens
   * can discover it for native large-title scroll tracking.
   * UploadButton FAB uses absolute positioning to float over content.
   *
   * key={numColumns} forces FlatList to re-mount when the column count
   * changes (e.g. on device rotation), which is required because
   * numColumns is not dynamically adjustable on an existing FlatList.
   */
  return (
    <>
      <FlatList
        key={numColumns}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        scrollToOverflowEnabled
        data={books.length === 0 && !isLoading ? [] : sortedBooks}
        renderItem={renderBookCard}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyLibrary />}
      />
      <UploadButton />
    </>
  );
}

const styles = StyleSheet.create({
  gridContent: {
    paddingHorizontal: GRID_PADDING - HALF_GAP,
    paddingTop: GRID_PADDING,
    paddingBottom: 100,
  },
  cardWrapper: {
    paddingHorizontal: HALF_GAP,
    marginBottom: GRID_GAP,
  },
});
