import React, { memo, useCallback } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Book } from '@/types/book';
import { BOOK_COVER_ASPECT_RATIO } from '@/constants/layout';

interface BookCardProps {
  book: Book;
  onPress: () => void;
  onDelete: (book: Book) => void;
}

function BookCard({ book, onPress, onDelete }: BookCardProps) {
  const handleLongPress = useCallback(() => {
    Alert.alert(
      'Remove Book',
      `Are you sure you want to remove "${book.title}" from your library? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onDelete(book),
        },
      ]
    );
  }, [book, onDelete]);

  return (
    <Pressable
      style={({ pressed }) => pressed && styles.pressed}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      <View
        className="w-full rounded-app-md overflow-hidden mb-xs bg-surface dark:bg-surface-dark"
        style={{ aspectRatio: 1 / BOOK_COVER_ASPECT_RATIO }}
      >
        {book.coverPath ? (
          <Image
            source={{ uri: book.coverPath }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 justify-center items-center p-sm bg-surface-secondary dark:bg-surface-dark-secondary">
            <Text className="text-[32px] mb-xs">📖</Text>
            <Text
              className="text-[11px] text-center font-medium text-text-secondary dark:text-text-secondary-dark"
              numberOfLines={3}
            >
              {book.title}
            </Text>
          </View>
        )}

        {/* Reading progress indicator */}
        {book.lastReadAt && (
          <View className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-tint dark:bg-tint-dark" />
        )}
      </View>

      <Text
        className="text-[13px] font-semibold leading-[17px] text-black dark:text-white"
        numberOfLines={2}
      >
        {book.title}
      </Text>
      <Text
        className="text-[11px] mt-0.5 text-text-secondary dark:text-text-secondary-dark"
        numberOfLines={1}
      >
        {book.author || 'Unknown Author'}
      </Text>
    </Pressable>
  );
}

export default memo(BookCard);

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
