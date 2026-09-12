import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PetListScreen } from './PetListScreen';
import { AddPetScreen } from './AddPetScreen';
import { PetHomeScreen } from './PetHomeScreen';
import { VaccineListScreen } from './VaccineListScreen';
import { AddVaccineScreen } from './AddVaccineScreen';
import { MedicationListScreen } from './MedicationListScreen';
import { AddMedicationScreen } from './AddMedicationScreen';
import { WeightLogScreen } from './WeightLogScreen';
import { ExpenseListScreen } from './ExpenseListScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
import { VetVisitListScreen } from './VetVisitListScreen';
import { AddVetVisitScreen } from './AddVetVisitScreen';
import { VetVisitDocumentsScreen } from './VetVisitDocumentsScreen';

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
      <Stack.Screen name="WeightLog" component={WeightLogScreen} />
      <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="VetVisitList" component={VetVisitListScreen} />
      <Stack.Screen name="AddVetVisit" component={AddVetVisitScreen} />
      <Stack.Screen name="VetVisitDocuments" component={VetVisitDocumentsScreen} />
    </Stack.Navigator>
  );
}
