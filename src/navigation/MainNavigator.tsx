import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './HomeScreen';
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
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' as const },
  headerBackTitle: '',
  contentStyle: { backgroundColor: colors.background },
};

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="PetList" component={HomeScreen} options={{ title: 'My Pets' }} />
      <Stack.Screen name="AddPet" component={AddPetScreen} options={{ title: 'Add Pet' }} />
      <Stack.Screen name="PetHome" component={PetHomeScreen} options={{ title: 'Pet Home' }} />
      <Stack.Screen name="VaccineList" component={VaccineListScreen} options={{ title: 'Vaccines' }} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} options={{ title: 'Add Vaccine' }} />
      <Stack.Screen name="MedicationList" component={MedicationListScreen} options={{ title: 'Medications' }} />
      <Stack.Screen name="AddMedication" component={AddMedicationScreen} options={{ title: 'Add Medication' }} />
      <Stack.Screen name="WeightLog" component={WeightLogScreen} options={{ title: 'Weight' }} />
      <Stack.Screen name="ExpenseList" component={ExpenseListScreen} options={{ title: 'Expenses' }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <Stack.Screen name="VetVisitList" component={VetVisitListScreen} options={{ title: 'Vet Visits' }} />
      <Stack.Screen name="AddVetVisit" component={AddVetVisitScreen} options={{ title: 'Add Vet Visit' }} />
      <Stack.Screen name="VetVisitDocuments" component={VetVisitDocumentsScreen} options={{ title: 'Documents' }} />
    </Stack.Navigator>
  );
}
