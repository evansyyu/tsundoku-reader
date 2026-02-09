import React, { memo, useCallback } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { SpineItem } from '@/types/book';

interface ChapterListModalProps {
  visible: boolean;
  spine: SpineItem[];
  currentChapterIndex: number;
  onSelectChapter: (index: number) => void;
  onClose: () => void;
}

/**
 * Modal that displays a scrollable list of all chapters (spine items).
 * Current chapter is highlighted. Respects app/system theme.
 */
function ChapterListModal({
  visible,
  spine,
  currentChapterIndex,
  onSelectChapter,
  onClose,
}: ChapterListModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const renderItem = useCallback(
    ({ item, index }: { item: SpineItem; index: number }) => {
      const isCurrent = index === currentChapterIndex;
      return (
        <Pressable
          className="flex-row items-center justify-between px-md"
          // StyleSheet kept: hairlineWidth, fixed ITEM_HEIGHT, dynamic background for active
          style={[
            styles.row,
            { borderBottomColor: colors.border },
            isCurrent && { backgroundColor: colors.tint + '14' },
          ]}
          onPress={() => {
            onSelectChapter(index);
            onClose();
          }}
        >
          <Text
            className={`flex-1 text-base mr-sm ${isCurrent ? 'font-semibold' : ''}`}
            style={{ color: isCurrent ? colors.tint : colors.text }}
            numberOfLines={1}
          >
            {formatChapterName(item.id, index)}
          </Text>
          <Text
            className={`text-sm ${isCurrent ? 'font-semibold' : ''}`}
            style={[
              { color: isCurrent ? colors.tint : colors.textSecondary },
              styles.tabularNums,
            ]}
          >
            {index + 1}
          </Text>
        </Pressable>
      );
    },
    [currentChapterIndex, onSelectChapter, onClose, colors]
  );

  const keyExtractor = useCallback((item: SpineItem) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* StyleSheet kept: paddingTop is dynamic safe area inset */}
      <View className="flex-1 bg-white dark:bg-black" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-md py-sm"
          style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
        >
          <Text className="text-lg font-bold text-black dark:text-white">Chapters</Text>
          <Pressable
            className="w-8 h-8 rounded-full justify-center items-center bg-surface-secondary dark:bg-surface-dark-secondary"
            onPress={onClose}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Chapter list */}
        <FlatList
          data={spine}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 48 }}
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
      </View>
    </Modal>
  );
}

/** Attempt to produce a human-readable chapter name from the spine ID / href */
function formatChapterName(id: string, index: number): string {
  let name = id.replace(/\.[^.]+$/, '').replace(/.*\//, '');
  name = name.replace(/[_-]/g, ' ');
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name || `Chapter ${index + 1}`;
}

const ITEM_HEIGHT = 52;

export default memo(ChapterListModal);

// StyleSheet kept: hairlineWidth, fixed row height, fontVariant
const styles = StyleSheet.create({
  row: {
    height: ITEM_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
});
