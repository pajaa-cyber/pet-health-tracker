import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MainNavigator } from './MainNavigator';
import { CalendarScreen } from './CalendarScreen';
import { VetsScreen } from './VetsScreen';
import { HouseholdScreen } from './HouseholdScreen';
import { AddSheet } from './AddSheet';
import { colors } from '../theme/theme';

const Tab = createBottomTabNavigator();

// Only the Pets tab has a nested stack with sub-screens the tab bar should
// hide behind. Its root route is named 'PetList' (Task 5) — anything else
// focused means we've pushed deeper and the tab bar should disappear.
function petsTabBarStyle(route: RouteProp<any, any>) {
  const focusedRoute = getFocusedRouteNameFromRoute(route) ?? 'PetList';
  return focusedRoute === 'PetList' ? undefined : { display: 'none' as const };
}

function RaisedAddButton(props: BottomTabBarButtonProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setSheetVisible(true)}
        style={{
          top: -16, alignSelf: 'center', width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#1E1B2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add"
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>
      <AddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="PetsTab"
        component={MainNavigator}
        options={({ route }) => ({
          title: 'Pets',
          tabBarStyle: [{ backgroundColor: colors.surface, borderTopColor: colors.border }, petsTabBarStyle(route)],
          tabBarIcon: ({ color, size }) => <Ionicons name="paw" size={size} color={color} />,
        })}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="AddTab"
        component={View} // never actually navigated to — tabBarButton fully replaces this tab's default press behavior
        options={{
          title: '',
          tabBarButton: (props) => <RaisedAddButton {...props} />,
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tab.Screen
        name="VetsTab"
        component={VetsScreen}
        options={{ title: 'Vets', tabBarIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="HouseholdTab"
        component={HouseholdScreen}
        options={{ title: 'Household', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}
