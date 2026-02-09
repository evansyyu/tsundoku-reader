import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBooks } from '@/contexts/BooksContext';
import BookListItem from '@/components/BookListItem';
import type { Book } from '@/types/book';

export default function SearchScreen() {
  const { books } = useBooks();
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filteredBooks = useMemo(() => {
    if (!query.trim()) return books;

    const lowerQuery = query.toLowerCase();
    return books.filter(
      (book) =>
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery)
    );
  }, [books, query]);

  const handleBookPress = useCallback(
    (book: Book) => {
      router.push(`/reader/${book.id}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Book }) => (
      <BookListItem book={item} onPress={() => handleBookPress(item)} />
    ),
    [handleBookPress]
  );

  const keyExtractor = useCallback((item: Book) => item.id, []);

  return (
    <>
      {/* Configure the native header search bar from within the screen
          so we own the query state. Stack.Screen renders no native view. */}
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Search by title or author...',
            onChangeText: (e) => setQuery(e.nativeEvent.text),
          },
        }}
      />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        scrollToOverflowEnabled
        data={filteredBooks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={
          <View className="items-center pt-24 px-lg">
            <Text className="text-base text-center leading-6 text-text-secondary dark:text-text-secondary-dark">
              {query.trim()
                ? 'No books match your search.'
                : 'Your library is empty. Import an EPUB to get started.'}
            </Text>
          </View>
        }
        className="px-md"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}
