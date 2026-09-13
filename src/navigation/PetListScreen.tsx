import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Image } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { ScreenContainer, Card, Button, Subtitle, MutedText } from '../components/ui';
import { colors, spacing } from '../theme/theme';

const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

export function PetListScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add a pet" onPress={() => navigation.navigate('AddPet')} />
      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('PetHome', { petId: item.id })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {item.photoUrl ? (
                <Image
                  source={{ uri: item.photoUrl }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  resizeMode="cover"
                />
              ) : (
                <Subtitle style={{ width: 40, textAlign: 'center', backgroundColor: colors.surfaceTint, borderRadius: 20, overflow: 'hidden', lineHeight: 40 }}>
                  {SPECIES_EMOJI[item.species] ?? '🐾'}
                </Subtitle>
              )}
              <Subtitle>{item.name}</Subtitle>
              <MutedText>({item.species})</MutedText>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<MutedText>No pets yet — add one to get started.</MutedText>}
      />
    </ScreenContainer>
  );
}
