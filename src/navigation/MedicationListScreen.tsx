import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';

export function MedicationListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToMedications(firestore, household.id, petId, setMedications);
  }, [household, petId]);

  const handleMarkGiven = async (medicationId: string) => {
    if (!household || !user) return;
    await logMedicationDose(firestore, household.id, petId, medicationId, user.uid);
  };

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={{ gap: 4 }}>
            <Text>{item.name} — {item.dosage} ({item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d)</Text>
            <Text>Last given: {item.log.length > 0 ? new Date(item.log[item.log.length - 1].givenAt).toLocaleString() : 'never'}</Text>
            <Button title="Mark dose as given" onPress={() => handleMarkGiven(item.id)} />
          </View>
        )}
        ListEmptyComponent={<Text>No medications yet.</Text>}
      />
    </View>
  );
}
