import React, { memo, useCallback } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { Book } from '@/types/book';
import { BOOK_CARD_WIDTH, BOOK_COVER_HEIGHT, BorderRadius, Spacing } from '@/constants/layout';

interface BookCardProps {
  book: Book;
  onPress: () => void;
  onDelete: (book: Book) => void;
}

function BookCard({ book, onPress, onDelete }: BookCardProps) {
  const { colors } = useTheme();

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
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      <View style={[styles.coverContainer, { backgroundColor: colors.surface }]}>
        {book.coverPath ? (
          <Image
            source={{ uri: book.coverPath }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholderCover, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.placeholderEmoji}>📖</Text>
            <Text
              style={[styles.placeholderTitle, { color: colors.textSecondary }]}
              numberOfLines={3}
            >
              {book.title}
            </Text>
          </View>
        )}

        {/* Reading progress indicator */}
        {book.lastReadAt && (
          <View style={[styles.progressDot, { backgroundColor: colors.tint }]} />
        )}
      </View>

      <Text
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
      >
        {book.title}
      </Text>
      <Text
        style={[styles.author, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {book.author || 'Unknown Author'}
      </Text>
    </Pressable>
  );
}

export default memo(BookCard);

const styles = StyleSheet.create({
  container: {
    width: BOOK_CARD_WIDTH,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  coverContainer: {
    width: '100%',
    height: BOOK_COVER_HEIGHT,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  placeholderEmoji: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  placeholderTitle: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  author: {
    fontSize: 11,
    marginTop: 2,
  },
});
