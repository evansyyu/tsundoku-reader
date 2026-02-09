import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { Book } from '@/types/book';

interface BookListItemProps {
  book: Book;
  onPress: () => void;
}

function BookListItem({ book, onPress }: BookListItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      className="flex-row items-center py-sm px-xs rounded-app-md mb-xs"
      // StyleSheet kept: dynamic pressed background color from theme
      style={({ pressed }) => [
        { backgroundColor: pressed ? colors.surface : 'transparent' },
      ]}
      onPress={onPress}
    >
      <View className="w-12 h-[72px] rounded-app-sm overflow-hidden justify-center items-center bg-surface dark:bg-surface-dark">
        {book.coverPath ? (
          <Image
            source={{ uri: book.coverPath }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <Text className="text-2xl">📖</Text>
        )}
      </View>

      <View className="flex-1 ml-md">
        <Text
          className="text-base font-semibold leading-5 text-black dark:text-white"
          numberOfLines={2}
        >
          {book.title}
        </Text>
        <Text
          className="text-sm mt-0.5 text-text-secondary dark:text-text-secondary-dark"
          numberOfLines={1}
        >
          {book.author || 'Unknown Author'}
        </Text>
        <Text
          className="text-xs mt-0.5 text-text-secondary dark:text-text-secondary-dark"
          numberOfLines={1}
        >
          {book.language === 'ja' ? '日本語' : book.language === 'en' ? 'English' : book.language}
        </Text>
      </View>
    </Pressable>
  );
}

export default memo(BookListItem);
