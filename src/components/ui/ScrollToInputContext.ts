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

// Takes the focus event's own `target` (the New Architecture's host
// instance) directly — scrollResponderScrollNativeHandleToKeyboard accepts
// `number | HostInstance`, so no findNodeHandle() detour is needed (and
// findNodeHandle's own types don't accept a ReactNativeElement anyway).
export function useScrollToInputOnFocus() {
  const scrollViewRef = useContext(ScrollToInputContext);
  return (target: Parameters<ScrollView['scrollResponderScrollNativeHandleToKeyboard']>[0]) => {
    const doScroll = () => scrollViewRef?.current?.scrollResponderScrollNativeHandleToKeyboard(target, 80, true);
    // Waiting for the keyboard's own "did show" event (rather than a fixed
    // delay) is what actually fixed this on-device — a flat setTimeout raced
    // the real keyboard animation and only won often enough to look like it
    // worked in quick manual tests. If the keyboard is already up (tabbing
    // between fields), that event never fires again, so scroll immediately
    // too as a fallback; whichever fires first wins, the other is a no-op
    // once unsubscribed.
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
  };
}
