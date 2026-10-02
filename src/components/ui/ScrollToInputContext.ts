import { createContext, useContext } from 'react';
import { Keyboard, ScrollView } from 'react-native';

// Lets a focused TextInput anywhere inside a scrollable ScreenContainer
// bring itself above the keyboard automatically, instead of the ScrollView
// silently doing nothing (found live on-device: a form whose content just
// barely fit one screen without a keyboard open left fields unreachable
// once the keyboard covered them, with no way to scroll to them either).
// Context rather than prop-threading since TextField is used many levels
// deep in every form screen.
export const ScrollToInputContext = createContext<React.RefObject<ScrollView | null> | null>(null);

// Runs `doScroll` once the keyboard's own "did show" event fires, not a
// fixed delay — an earlier setTimeout-based version raced the real keyboard
// animation and only won often enough to look right in quick manual tests,
// not reliably on a real device. If the keyboard is already up (tabbing
// between fields), that event never fires again, so a timeout fallback
// still fires the scroll; whichever fires first wins, the other is a no-op.
function afterKeyboardShown(doScroll: () => void) {
  let done = false;
  const sub = Keyboard.addListener('keyboardDidShow', () => {
    if (done) return;
    done = true;
    sub.remove();
    doScroll();
  });
  setTimeout(() => {
    if (done) return;
    done = true;
    sub.remove();
    doScroll();
  }, 250);
}

// How far below the header the focused field should land — not flush
// against it, just enough breathing room to read the label above it.
const TOP_PADDING = 16;

// Scrolls the focused field to a fixed position near the TOP of the
// visible scroll area (just under the header), not to "just above the
// keyboard" — found live on-device that the keyboard-relative approach
// (scrollResponderScrollNativeHandleToKeyboard, used here previously)
// gave inconsistent, surprising results depending on where the field
// already sat: a field near the top of a long form could get scrolled
// UP past the header and out of view entirely (confirmed: Microchip
// provider/number did this once scrollToEnd was added to them — see
// EditPetScreen's own comment on why those two no longer use it), while
// fields lower down could still end up partly clipped by the keyboard.
// A fixed "always land near the top" target is simple and predictable
// regardless of where the field sits in the form. measureLayout's `top`
// is already relative to the ScrollView's own content, so no separate
// tracking of the current scroll offset is needed — unlike
// scrollResponderScrollNativeHandleToKeyboard, which worked in
// screen-relative (keyboard-relative) coordinates instead.
export function useScrollToInputOnFocus() {
  const scrollViewRef = useContext(ScrollToInputContext);
  return (target: any) => {
    afterKeyboardShown(() => {
      const scrollView = scrollViewRef?.current;
      // measureLayout's relativeTo argument needs an actual ref to a native
      // component under the New Architecture — passing a derived node
      // handle (e.g. getScrollableNode()'s return value) is rejected with
      // "ref.measureLayout must be called with a ref to a native
      // component" (confirmed live on-device). The ScrollView ref itself
      // is accepted directly.
      if (!scrollView || !target?.measureLayout) return;
      target.measureLayout(
        scrollView,
        (_left: number, top: number) => {
          scrollView.scrollTo({ y: Math.max(0, top - TOP_PADDING), animated: true });
        },
        () => {}
      );
    });
  };
}

// For a TextField that's part of a cluster of fields sitting right above a
// submit button (e.g. a marker row followed by "Save") — scrolling to just
// the focused field alone can reveal that one field while leaving the
// button (and any fields after it) below the keyboard fold, needing extra
// manual scrolling to reach. Scrolling to the end of the content instead
// keeps the whole cluster-plus-button together. Opt-in per field via
// TextField's `scrollToEnd` prop, not the default, since it would cut off
// an early field in a long form that isn't near the bottom.
export function useScrollToEndOnFocus() {
  const scrollViewRef = useContext(ScrollToInputContext);
  return () => {
    afterKeyboardShown(() => {
      scrollViewRef?.current?.scrollToEnd({ animated: true });
    });
  };
}
