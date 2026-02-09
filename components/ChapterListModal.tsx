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
import { Spacing } from '@/constants/layout';

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
            style={[
              styles.chapterName,
              { color: isCurrent ? colors.tint : colors.text },
              isCurrent && styles.chapterNameActive,
            ]}
            numberOfLines={1}
          >
            {formatChapterName(item.id, index)}
          </Text>
          <Text
            style={[
              styles.chapterPos,
              { color: isCurrent ? colors.tint : colors.textSecondary },
              isCurrent && styles.chapterPosActive,
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
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chapters</Text>
          <Pressable
            style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: ITEM_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterName: {
    flex: 1,
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  chapterNameActive: {
    fontWeight: '600',
  },
  chapterPos: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  chapterPosActive: {
    fontWeight: '600',
  },
});
