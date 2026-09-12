import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PetListScreen } from './PetListScreen';
import { AddPetScreen } from './AddPetScreen';
import { PetHomeScreen } from './PetHomeScreen';

const Stack = createNativeStackNavigator();

export function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PetList" component={PetListScreen} />
      <Stack.Screen name="AddPet" component={AddPetScreen} />
      <Stack.Screen name="PetHome" component={PetHomeScreen} />
    </Stack.Navigator>
  );
}
