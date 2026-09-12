// Placeholder — replaced in Task 15.
import React from 'react';
import { View, Text, Button } from 'react-native';

export function PetHomeScreen({ route, navigation }: any) {
  return (
    <View style={{ padding: 24 }}>
      <Text>Pet home for {route.params?.petId} — record screens added in later tasks.</Text>
      <Button title="Vaccines" onPress={() => navigation.navigate('VaccineList', { petId: route.params?.petId })} />
      <Button title="Medications" onPress={() => navigation.navigate('MedicationList', { petId: route.params?.petId })} />
      <Button title="Weight" onPress={() => navigation.navigate('WeightLog', { petId: route.params?.petId })} />
      <Button title="Expenses" onPress={() => navigation.navigate('ExpenseList', { petId: route.params?.petId })} />
    </View>
  );
}
