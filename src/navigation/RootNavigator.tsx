import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { SignInScreen } from '../auth/SignInScreen';
import { SignUpScreen } from '../auth/SignUpScreen';
import { HouseholdSetupScreen } from './HouseholdSetupScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
