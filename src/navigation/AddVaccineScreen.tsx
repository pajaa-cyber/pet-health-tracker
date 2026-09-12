import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createVaccine } from '../pets/vaccineService';
import { firestore } from '../firebase/config';

export function AddVaccineScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [vetName, setVetName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createVaccine(firestore, household.id, petId, name, Date.now(), null, vetName);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Vaccine name" value={name} onChangeText={setName} />
      <TextInput placeholder="Vet name" value={vetName} onChangeText={setVetName} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add vaccine" onPress={handleSubmit} />
    </View>
  );
}
