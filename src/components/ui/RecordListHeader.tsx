import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shell, text, spacing } from '../../theme/theme';

interface RecordListHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

// The shared header every record-list screen uses (README §3): a round
// back button + title + "{Pet} · {n} entries" sub-line. These screens run
// with headerShown: false (no native header), so this also carries the
// top safe-area inset itself — the same fix Part A's final review had to
// add after the native header's implicit padding disappeared.
export function RecordListHeader({ title, subtitle, onBack }: RecordListHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.backButton}
      >
        <Text style={styles.backGlyph}>←</Text>
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: shell.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 18,
    color: text.primary,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: text.primary,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: text.secondary,
    marginTop: 2,
  },
});
