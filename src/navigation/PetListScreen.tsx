import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';

export function PetListScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add a pet" onPress={() => navigation.navigate('AddPet')} />
      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text onPress={() => navigation.navigate('PetHome', { petId: item.id })}>
            {item.name} ({item.species})
          </Text>
        )}
        ListEmptyComponent={<Text>No pets yet — add one to get started.</Text>}
      />
    </View>
  );
}
