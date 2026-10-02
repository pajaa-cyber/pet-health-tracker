import React, { useRef } from 'react';
import { View, ScrollView, ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/theme';
import { ScrollToInputContext } from './ScrollToInputContext';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  background?: string; // overrides the screen's base background colour (default colors.background) — the reskin passes shell.bg
  // For a screen that manages its own padding entirely (a colour-band
  // header, a FlatList with its own contentContainerStyle, etc.) — skips
  // styles.content/edgeInsets outright. The previous way to do this,
  // `style={{ padding: 0, ... }}`, LOOKED like it worked but didn't:
  // `padding: 0` and edgeInsets' `paddingLeft`/`paddingRight`/
  // `paddingBottom` are different style keys, so both ended up in the
  // final flattened style object, and Yoga resolves that by preferring
  // the more specific paddingLeft/Right/Bottom over the generic `padding`
  // — regardless of which one is later in the array. The screen's own
  // padding then stacked on top of ScreenContainer's un-zeroed padding
  // (and the screen's own ListHeaderComponent/FlatList padding on top of
  // that again, for screens with both) — found live on-device as
  // CalendarScreen's content sitting under ~3x the intended side margin,
  // "like it's zoomed out". Confirmed via exact pixel measurement
  // (156px actual vs. 52px expected on a 520dpi device — three stacked
  // spacing.md layers, not one).
  noPadding?: boolean;
}

// Most add/edit forms need `scroll` (content can exceed one screen once a
// DateField or two is added); list screens pass a FlatList as a direct
// child instead and leave scroll off, since ScrollView+FlatList nesting
// breaks FlatList's own virtualization.
export function ScreenContainer({ scroll, style, background, noPadding, children, ...rest }: ScreenContainerProps) {
  // Some Android skins (Honor et al.) render on-screen nav buttons that
  // overlap the last bit of scrollable content otherwise — insets.bottom is
  // 0 on devices with a real gesture bar, so this is a no-op there.
  // insets.left/right cover curved-edge screens (same Honor-et-al. family) —
  // a device-reported real-user confirmed the Home screen's Settings avatar
  // sitting right under the screen's physical curve, barely tappable. 0 on
  // flat-edge devices, so this is a no-op there too.
  const insets = useSafeAreaInsets();
  const edgeInsets = { paddingBottom: spacing.md + insets.bottom, paddingLeft: spacing.md + insets.left, paddingRight: spacing.md + insets.right };
  const bgOverride = background ? { backgroundColor: background } : undefined;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentStyle = noPadding ? null : [styles.content, edgeInsets];
  if (scroll) {
    return (
      <ScrollToInputContext.Provider value={scrollViewRef}>
        <ScrollView
          ref={scrollViewRef}
          style={[styles.background, bgOverride]}
          contentContainerStyle={[contentStyle, style]}
          keyboardShouldPersistTaps="handled"
          {...rest}
        >
          {children}
        </ScrollView>
      </ScrollToInputContext.Provider>
    );
  }
  return (
    <View style={[styles.background, contentStyle, bgOverride, style]} {...rest}>
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
