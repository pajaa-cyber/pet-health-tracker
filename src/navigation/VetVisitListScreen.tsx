import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function VetVisitListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToVetVisits(firestore, household.id, petId, setVisits);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Vet visits"
        subtitle={`${pet?.name ?? 'Pet'} · ${visits.length} ${visits.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <View style={{ width: 6, backgroundColor: rail }} />
            <View style={{ flex: 1, padding: 14, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.reason}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              {item.notes ? (
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.notes}</Text>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: text.secondary, fontSize: 14, textAlign: 'center', paddingTop: spacing.xl }}>
            No vet visits recorded yet.
          </Text>
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a vet visit" onPress={() => navigation.navigate('AddVetVisit', { petId })} />
      </View>
    </ScreenContainer>
  );
}
