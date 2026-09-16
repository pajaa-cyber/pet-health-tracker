import React from 'react';
import { View, ScrollView, ViewProps, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/theme';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  background?: string; // overrides the screen's base background colour (default colors.background) — the reskin passes shell.bg
}

// Most add/edit forms need `scroll` (content can exceed one screen once a
// DateField or two is added); list screens pass a FlatList as a direct
// child instead and leave scroll off, since ScrollView+FlatList nesting
// breaks FlatList's own virtualization.
export function ScreenContainer({ scroll, style, background, children, ...rest }: ScreenContainerProps) {
  const bgOverride = background ? { backgroundColor: background } : undefined;
  if (scroll) {
    return (
      <ScrollView
        style={[styles.background, bgOverride]}
        contentContainerStyle={[styles.content, style]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.background, styles.content, bgOverride, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
});
