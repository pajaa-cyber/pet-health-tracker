// src/navigation/PetHomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { WeightTrendChart } from '../pets/WeightTrendChart';

export function PetHomeScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setWeightLogs);
  }, [household, petId]);

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <WeightTrendChart logs={weightLogs} />
      <Button title="Vaccines" onPress={() => navigation.navigate('VaccineList', { petId })} />
      <Button title="Medications" onPress={() => navigation.navigate('MedicationList', { petId })} />
      <Button title="Vet Visits" onPress={() => navigation.navigate('VetVisitList', { petId })} />
      <Button title="Weight" onPress={() => navigation.navigate('WeightLog', { petId })} />
      <Button title="Expenses" onPress={() => navigation.navigate('ExpenseList', { petId })} />
    </View>
  );
}
