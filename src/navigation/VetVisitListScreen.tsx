import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';

export function VetVisitListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [visits, setVisits] = useState<VetVisit[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVetVisits(firestore, household.id, petId, setVisits);
  }, [household, petId]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add vet visit" onPress={() => navigation.navigate('AddVetVisit', { petId })} />
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Text onPress={() => navigation.navigate('VetVisitDocuments', { petId, visitId: item.id })}>
            {new Date(item.date).toLocaleDateString()} — {item.reason}: {item.notes} ({item.documentUrls.length} docs)
          </Text>
        )}
        ListEmptyComponent={<Text>No vet visits recorded yet.</Text>}
      />
    </View>
  );
}
