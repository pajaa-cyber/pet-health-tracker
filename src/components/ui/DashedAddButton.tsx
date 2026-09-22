import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { shell, text } from '../../theme/theme';

interface DashedAddButtonProps {
  label: string;
  onPress: () => void;
}

// The record-list screens' full-width dashed "Add a vaccine" / "Log a
// weight" / etc. footer button (README §3). A dedicated small component
// because it's reused identically (only the label differs) across 5
// screens — extracting it once avoids duplicating the same styled
// Pressable 5 times, per this plan's file-structure rationale.
export function DashedAddButton({ label, onPress }: DashedAddButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: shell.cardBorderDashed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: text.primary,
  },
});
