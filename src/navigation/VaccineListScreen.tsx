import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Vaccine } from '../types/vaccine';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function VaccineListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, petId, setVaccines);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Vaccines"
        subtitle={`${pet?.name ?? 'Pet'} · ${vaccines.length} ${vaccines.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={vaccines}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <View style={{ width: 6, backgroundColor: rail }} />
            <View style={{ flex: 1, padding: 14, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.name}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                Given {new Date(item.dateGiven).toLocaleDateString()}
              </Text>
              {item.nextDueDate && (
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  Next due {new Date(item.nextDueDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="💉"
            title="No vaccines logged yet"
            message="Track vaccinations here to spot what's due and keep a full record for the vet."
            actionLabel="Add a vaccine"
            onAction={() => navigation.navigate('AddVaccine', { petId })}
            variant="dark"
          />
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a vaccine" onPress={() => navigation.navigate('AddVaccine', { petId })} />
      </View>
    </ScreenContainer>
  );
}
