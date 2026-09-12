import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { HouseholdProvider } from './src/household/HouseholdContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <RootNavigator />
      </HouseholdProvider>
    </AuthProvider>
  );
}
