import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBooks } from '@/contexts/BooksContext';
import BookCard from '@/components/BookCard';
import EmptyLibrary from '@/components/EmptyLibrary';
import UploadButton from '@/components/UploadButton';
import type { Book } from '@/types/book';
import { GRID_COLUMNS, GRID_GAP, GRID_PADDING, Spacing } from '@/constants/layout';

export default function BooksScreen() {
  const { colors } = useTheme();
  const { books, isLoading, removeBook } = useBooks();
  const router = useRouter();

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
      <BookCard
        book={item}
        onPress={() => handleBookPress(item)}
        onDelete={handleDeleteBook}
      />
    ),
    [handleBookPress, handleDeleteBook]
  );

  const keyExtractor = useCallback((item: Book) => item.id, []);

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {books.length === 0 && !isLoading ? (
        <EmptyLibrary />
      ) : (
        <FlatList
          data={sortedBooks}
          renderItem={renderBookCard}
          keyExtractor={keyExtractor}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />
      )}

      <UploadButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gridContent: {
    padding: GRID_PADDING,
    paddingBottom: 100, // Space for FAB
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
});
