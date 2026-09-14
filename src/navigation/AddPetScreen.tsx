import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet, updatePetPhoto, subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, PetSpecies } from '../types/pet';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText, Chip, AvatarPicker } from '../components/ui';
import { spacing } from '../theme/theme';

const SPECIES: PetSpecies[] = ['dog', 'cat', 'other'];

export function AddPetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState(Date.now());
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [existingPets, setExistingPets] = useState<Pet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setExistingPets);
  }, [household]);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      const pet = await createPet(firestore, household.id, name, species, breed, birthDate, existingPets);
      if (photoDataUri) {
        await updatePetPhoto(firestore, household.id, pet.id, photoDataUri);
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <AvatarPicker photoUri={photoDataUri} onPicked={setPhotoDataUri} />
      <TextField label="Name" placeholder="Pet's name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {SPECIES.map((s) => (
          <Chip key={s} label={s} selected={species === s} onPress={() => setSpecies(s)} />
        ))}
      </View>
      <TextField label="Breed" placeholder="Optional" value={breed} onChangeText={setBreed} />
      <DateField label="Birth date" value={birthDate} onChange={setBirthDate} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add pet" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
