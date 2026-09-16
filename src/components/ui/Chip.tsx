import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../theme/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  selectedBg?: string;
  selectedColor?: string;
  unselectedBg?: string;
  unselectedColor?: string;
}

export function Chip({ label, selected, onPress, selectedBg, selectedColor, unselectedBg, unselectedColor }: ChipProps) {
  const bg = resolveChipBg(selected, selectedBg, unselectedBg);
  const labelColor = resolveChipColor(selected, selectedColor, unselectedColor);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

// Exported so the override logic itself — not just the rendered tree — is
// directly unit-testable without a React renderer.
export function resolveChipBg(selected: boolean, selectedBg?: string, unselectedBg?: string): string {
  return selected ? (selectedBg ?? colors.primary) : (unselectedBg ?? colors.surfaceTint);
}

export function resolveChipColor(selected: boolean, selectedColor?: string, unselectedColor?: string): string {
  return selected ? (selectedColor ?? '#FFFFFF') : (unselectedColor ?? colors.primaryDark);
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
