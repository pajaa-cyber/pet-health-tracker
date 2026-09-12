import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PetListScreen } from './PetListScreen';
import { AddPetScreen } from './AddPetScreen';
import { PetHomeScreen } from './PetHomeScreen';
import { VaccineListScreen } from './VaccineListScreen';
import { AddVaccineScreen } from './AddVaccineScreen';
import { MedicationListScreen } from './MedicationListScreen';
import { AddMedicationScreen } from './AddMedicationScreen';

const Stack = createNativeStackNavigator();

export function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PetList" component={PetListScreen} />
      <Stack.Screen name="AddPet" component={AddPetScreen} />
      <Stack.Screen name="PetHome" component={PetHomeScreen} />
      <Stack.Screen name="VaccineList" component={VaccineListScreen} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} />
      <Stack.Screen name="MedicationList" component={MedicationListScreen} />
      <Stack.Screen name="AddMedication" component={AddMedicationScreen} />
    </Stack.Navigator>
  );
}
