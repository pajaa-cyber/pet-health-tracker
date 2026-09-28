import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/reminders/notificationSetup';
import { AuthProvider } from './src/auth/AuthContext';
import { HouseholdProvider } from './src/household/HouseholdContext';
import { PetSelectionProvider } from './src/selection/PetSelectionContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    // Every screen's bottom padding (ScreenContainer, MainTabs' tab bar
    // height, per-screen headers) reads useSafeAreaInsets() — without this
    // Provider at the root, that hook has no real inset value to read and
    // falls back to zero everywhere, which is exactly why content and
    // buttons on screen after screen sat flush against (or under) the
    // device's on-screen system navigation bar instead of clearing it.
    <SafeAreaProvider>
      <AuthProvider>
        <HouseholdProvider>
          <PetSelectionProvider>
            <RootNavigator />
          </PetSelectionProvider>
        </HouseholdProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
