import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainNavigator } from './MainNavigator';
import { CalendarScreen } from './CalendarScreen';
import { VetsScreen } from './VetsScreen';
import { HouseholdScreen } from './HouseholdScreen';
import { AddSheet } from './AddSheet';
import { colors, shell, text } from '../theme/theme';

const Tab = createBottomTabNavigator();

// Only the Pets tab has a nested stack with sub-screens the tab bar should
// hide behind. Its root route is named 'PetList' — anything else focused
// means we've pushed deeper and the tab bar should disappear.
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
          top: -16, alignSelf: 'center', width: 60, height: 60, borderRadius: 30,
          backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 10,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add"
      >
        <Ionicons name="add" size={30} color={colors.accentText} />
      </Pressable>
      <AddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const baseTabBarStyle = {
    backgroundColor: shell.tabBar,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 10 + insets.bottom,
    height: 64 + insets.bottom,
  };
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: text.primary,
        tabBarInactiveTintColor: text.faint,
        tabBarStyle: baseTabBarStyle,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="PetsTab"
        component={MainNavigator}
        options={({ route }) => ({
          title: 'Pets',
          tabBarStyle: [baseTabBarStyle, petsTabBarStyle(route)],
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
