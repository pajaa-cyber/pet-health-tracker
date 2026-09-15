import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { SignInScreen } from '../auth/SignInScreen';
import { SignUpScreen } from '../auth/SignUpScreen';
import { HouseholdSetupScreen } from './HouseholdSetupScreen';
import { MainTabs } from './MainTabs';
import { ReminderSettingsScreen } from './ReminderSettingsScreen';
import { ReminderRescheduler } from '../reminders/ReminderRescheduler';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, initializing } = useAuth();
  const { household, loading: householdLoading } = useHousehold();

  if (initializing) return null;
  if (user && householdLoading) return null;

  return (
    <NavigationContainer>
      {household && <ReminderRescheduler />}
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {!user ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : household ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ReminderSettings"
              component={ReminderSettingsScreen}
              options={{ headerShown: true, title: 'Reminder settings', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
            />
          </>
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
