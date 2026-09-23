import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './HomeScreen';
import { AddPetScreen } from './AddPetScreen';
import { PetHomeScreen } from './PetHomeScreen';
import { EditPetScreen } from './EditPetScreen';
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
import { DocumentListScreen } from './DocumentListScreen';
import { ChoosePetForAddScreen } from './ChoosePetForAddScreen';
import { DevStyleGuideScreen } from './DevStyleGuideScreen';
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
      <Stack.Screen name="PetList" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddPet" component={AddPetScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PetHome" component={PetHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditPet" component={EditPetScreen} options={{ title: 'Edit Pet' }} />
      <Stack.Screen name="VaccineList" component={VaccineListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} options={{ title: 'Add Vaccine' }} />
      <Stack.Screen name="MedicationList" component={MedicationListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddMedication" component={AddMedicationScreen} options={{ title: 'Add Medication' }} />
      <Stack.Screen name="WeightLog" component={WeightLogScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ExpenseList" component={ExpenseListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <Stack.Screen name="VetVisitList" component={VetVisitListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddVetVisit" component={AddVetVisitScreen} options={{ title: 'Add Vet Visit' }} />
      <Stack.Screen name="VetVisitDocuments" component={VetVisitDocumentsScreen} options={{ title: 'Documents' }} />
      <Stack.Screen name="DocumentList" component={DocumentListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChoosePetForAdd" component={ChoosePetForAddScreen} options={{ title: 'Choose a pet' }} />
      <Stack.Screen name="DevStyleGuide" component={DevStyleGuideScreen} options={{ title: 'Style Guide' }} />
    </Stack.Navigator>
  );
}
