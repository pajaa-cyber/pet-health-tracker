import React, { useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { ScreenContainer, Card, Subtitle, MutedText, GuidedEmptyState } from '../components/ui';
import { spacing } from '../theme/theme';
import { petColor } from '../theme/petColors';

export function ChoosePetForAddScreen({ route, navigation }: any) {
  const { targetRoute } = route.params ?? {};
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  if (pets.length === 0) {
    return (
      <ScreenContainer style={{ flex: 1 }}>
        <GuidedEmptyState
          emoji="🐾"
          title="No pets yet"
          message="Add a pet first, then come back to add this for them."
          actionLabel="Add a Pet"
          onAction={() => navigation.navigate('PetsTab', { screen: 'AddPet' })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <MutedText>Who is this for?</MutedText>
      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.replace(targetRoute, { petId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={item.name}>
            <Card style={{ borderLeftWidth: 4, borderLeftColor: petColor(item) }}>
              <Subtitle>{item.name}</Subtitle>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
