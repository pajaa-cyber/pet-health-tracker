import React, { useRef } from 'react';
import { View, ScrollView, ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/theme';
import { ScrollToInputContext } from './ScrollToInputContext';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  background?: string; // overrides the screen's base background colour (default colors.background) — the reskin passes shell.bg
}

// Most add/edit forms need `scroll` (content can exceed one screen once a
// DateField or two is added); list screens pass a FlatList as a direct
// child instead and leave scroll off, since ScrollView+FlatList nesting
// breaks FlatList's own virtualization.
export function ScreenContainer({ scroll, style, background, children, ...rest }: ScreenContainerProps) {
  // Some Android skins (Honor et al.) render on-screen nav buttons that
  // overlap the last bit of scrollable content otherwise — insets.bottom is
  // 0 on devices with a real gesture bar, so this is a no-op there.
  const insets = useSafeAreaInsets();
  const bottomInset = { paddingBottom: spacing.md + insets.bottom };
  const bgOverride = background ? { backgroundColor: background } : undefined;
  const scrollViewRef = useRef<ScrollView>(null);
  if (scroll) {
    return (
      <ScrollToInputContext.Provider value={scrollViewRef}>
        <ScrollView
          ref={scrollViewRef}
          style={[styles.background, bgOverride]}
          contentContainerStyle={[styles.content, bottomInset, style]}
          keyboardShouldPersistTaps="handled"
          {...rest}
        >
          {children}
        </ScrollView>
      </ScrollToInputContext.Provider>
    );
  }
  return (
    <View style={[styles.background, styles.content, bottomInset, bgOverride, style]} {...rest}>
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
