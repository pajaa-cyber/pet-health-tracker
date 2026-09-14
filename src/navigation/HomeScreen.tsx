import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Image, View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { getNextDue } from '../pets/upcomingSummary';
import { usePetSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { ScreenContainer, Card, Button, Subtitle, BodyText, MutedText, PetSelector } from '../components/ui';
import { colors, spacing } from '../theme/theme';
import { petColor } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';

function speciesAndAge(pet: Pet): string {
  if (pet.birthDate == null) return speciesDisplay(pet);
  const ageMs = Date.now() - pet.birthDate;
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  return `${speciesDisplay(pet)}${years >= 0 ? ` · ${years} yr` : ''}`;
}

function PetCard({ pet, navigation }: { pet: Pet; navigation: any }) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const { household } = useHousehold();

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, pet.id, setVaccines);
  }, [household, pet.id]);

  const nextDue = getNextDue(vaccines, Date.now());

  return (
    <Pressable
      onPress={() => navigation.navigate('PetHome', { petId: pet.id })}
      accessibilityRole="button"
      accessibilityLabel={pet.name}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: petColor(pet) }}>
        {pet.photoUrl ? (
          <Image source={{ uri: pet.photoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' }}>
            <Subtitle>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Subtitle>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Subtitle>{pet.name}</Subtitle>
          <MutedText>{speciesAndAge(pet)}</MutedText>
          {nextDue ? (
            <BodyText style={{ color: nextDue.overdue ? colors.danger : colors.primaryDark, fontWeight: '600' }}>
              {nextDue.label}
            </BodyText>
          ) : (
            <MutedText>Nothing due</MutedText>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: any) {
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const visiblePets = selectedPetId === 'all' ? pets : pets.filter((p) => p.id === selectedPetId);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add a pet" onPress={() => navigation.navigate('AddPet')} />
      {pets.length > 0 && <PetSelector pets={pets} />}
      <FlatList
        data={visiblePets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => <PetCard pet={item} navigation={navigation} />}
        ListEmptyComponent={<MutedText>No pets yet — add one to get started.</MutedText>}
      />
    </ScreenContainer>
  );
}
