import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { Book } from '@/types/book';
import { BorderRadius, Spacing } from '@/constants/layout';

interface BookListItemProps {
  book: Book;
  onPress: () => void;
}

function BookListItem({ book, onPress }: BookListItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: pressed ? colors.surface : 'transparent' },
      ]}
      onPress={onPress}
    >
      <View style={[styles.cover, { backgroundColor: colors.surface }]}>
        {book.coverPath ? (
          <Image
            source={{ uri: book.coverPath }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.coverPlaceholder}>📖</Text>
        )}
      </View>

      <View style={styles.info}>
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
        <Text
          style={[styles.language, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {book.language === 'ja' ? '日本語' : book.language === 'en' ? 'English' : book.language}
        </Text>
      </View>
    </Pressable>
  );
}

export default memo(BookListItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  cover: {
    width: 48,
    height: 72,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  author: {
    fontSize: 14,
    marginTop: 2,
  },
  language: {
    fontSize: 12,
    marginTop: 2,
  },
});
