import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { firestore } from '../firebase/config';
import { Vaccine } from '../types/vaccine';

export function VaccineListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, petId, setVaccines);
  }, [household, petId]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add vaccine" onPress={() => navigation.navigate('AddVaccine', { petId })} />
      <FlatList
        data={vaccines}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Text>
            {item.name} — given {new Date(item.dateGiven).toLocaleDateString()}
            {item.nextDueDate ? `, due ${new Date(item.nextDueDate).toLocaleDateString()}` : ''}
          </Text>
        )}
        ListEmptyComponent={<Text>No vaccine records yet.</Text>}
      />
    </View>
  );
}
