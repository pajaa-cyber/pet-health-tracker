import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet } from '../pets/petService';
import { firestore } from '../firebase/config';
import { PetSpecies } from '../types/pet';

export function AddPetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createPet(firestore, household.id, name, species, breed, Date.now());
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Name" value={name} onChangeText={setName} />
      <Button title="Dog" onPress={() => setSpecies('dog')} />
      <Button title="Cat" onPress={() => setSpecies('cat')} />
      <Button title="Other" onPress={() => setSpecies('other')} />
      <Text>Selected species: {species}</Text>
      <TextInput placeholder="Breed" value={breed} onChangeText={setBreed} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add pet" onPress={handleSubmit} />
    </View>
  );
}
