import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radii, spacing, shadow } from '../../theme/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow,
  },
});
