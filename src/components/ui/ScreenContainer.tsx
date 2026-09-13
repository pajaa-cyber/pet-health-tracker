import React from 'react';
import { View, ScrollView, ViewProps, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/theme';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
}

// Most add/edit forms need `scroll` (content can exceed one screen once a
// DateField or two is added); list screens pass a FlatList as a direct
// child instead and leave scroll off, since ScrollView+FlatList nesting
// breaks FlatList's own virtualization.
export function ScreenContainer({ scroll, style, children, ...rest }: ScreenContainerProps) {
  if (scroll) {
    return (
      <ScrollView
        style={styles.background}
        contentContainerStyle={[styles.content, style]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.background, styles.content, style]} {...rest}>
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
