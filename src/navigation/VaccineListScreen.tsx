import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable, Alert } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines, deleteVaccine } from '../pets/vaccineService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Vaccine } from '../types/vaccine';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing, colors } from '../theme/theme';

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

  const handleDelete = (vaccineId: string) => {
    if (!household) return;
    Alert.alert('Delete vaccine?', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteVaccine(firestore, household.id, petId, vaccineId) },
    ]);
  };

  return (
    <ScreenContainer noPadding style={{ flex: 1 }} background={shell.bg}>
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
            <Pressable
              onPress={() => handleDelete(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="💉"
            title="No vaccines logged yet"
            message="Track vaccinations here to spot what's due and keep a full record for the vet."
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
