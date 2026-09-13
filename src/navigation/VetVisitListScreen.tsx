import React, { useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';
import { ScreenContainer, Card, Button, Subtitle, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function VetVisitListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [visits, setVisits] = useState<VetVisit[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVetVisits(firestore, household.id, petId, setVisits);
  }, [household, petId]);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add vet visit" onPress={() => navigation.navigate('AddVetVisit', { petId })} />
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('VetVisitDocuments', { petId, visitId: item.id })}>
            <Card style={{ gap: spacing.xs }}>
              <Subtitle>{item.reason}</Subtitle>
              <MutedText>{new Date(item.date).toLocaleDateString()}</MutedText>
              {item.notes ? <MutedText>{item.notes}</MutedText> : null}
              <MutedText>{item.documentUrls.length} document{item.documentUrls.length === 1 ? '' : 's'}</MutedText>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<MutedText>No vet visits recorded yet.</MutedText>}
      />
    </ScreenContainer>
  );
}
