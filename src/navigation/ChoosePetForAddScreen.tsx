import React, { useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { ScreenContainer, Card, Subtitle, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';
import { petColor } from '../theme/petColors';

export function ChoosePetForAddScreen({ route, navigation }: any) {
  const { targetRoute } = route.params ?? {};
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

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
        ListEmptyComponent={<MutedText>Add a pet first.</MutedText>}
      />
    </ScreenContainer>
  );
}
