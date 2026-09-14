import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { firestore } from '../firebase/config';
import { Vaccine } from '../types/vaccine';
import { ScreenContainer, Card, Button, Subtitle, MutedText, GuidedEmptyState } from '../components/ui';
import { spacing } from '../theme/theme';

export function VaccineListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, petId, setVaccines);
  }, [household, petId]);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add vaccine" onPress={() => navigation.navigate('AddVaccine', { petId })} />
      <FlatList
        data={vaccines}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.xs }}>
            <Subtitle>{item.name}</Subtitle>
            <MutedText>Given {new Date(item.dateGiven).toLocaleDateString()}</MutedText>
            {item.nextDueDate && <MutedText>Next due {new Date(item.nextDueDate).toLocaleDateString()}</MutedText>}
          </Card>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="💉"
            title="No vaccines logged yet"
            message="Track vaccinations here to spot what's due and keep a full record for the vet."
            actionLabel="Add a vaccine"
            onAction={() => navigation.navigate('AddVaccine', { petId })}
          />
        }
      />
    </ScreenContainer>
  );
}
