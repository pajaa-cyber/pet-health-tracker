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

// Takes the focus event's own `target` (the New Architecture's host
// instance) directly — scrollResponderScrollNativeHandleToKeyboard accepts
// `number | HostInstance`, so no findNodeHandle() detour is needed (and
// findNodeHandle's own types don't accept a ReactNativeElement anyway).
export function useScrollToInputOnFocus() {
  const scrollViewRef = useContext(ScrollToInputContext);
  return (target: Parameters<ScrollView['scrollResponderScrollNativeHandleToKeyboard']>[0]) => {
    afterKeyboardShown(() => {
      scrollViewRef?.current?.scrollResponderScrollNativeHandleToKeyboard(target, 80, true);
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
