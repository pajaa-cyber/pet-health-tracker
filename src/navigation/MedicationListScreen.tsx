import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';

export function MedicationListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!household) return;
    return subscribeToMedications(firestore, household.id, petId, setMedications);
  }, [household, petId]);

  // Matches the setError(null) -> try -> catch (e: any) => setError(e.message)
  // pattern every other action handler in this codebase uses (see
  // AddMedicationScreen.tsx). Without it a failed dose write — the single
  // most safety-relevant action in the app — was an unhandled promise
  // rejection with no user-visible feedback at all.
  const handleMarkGiven = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await logMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // The dose log stores `givenBy` as a raw userId; the spec asks for
  // "who/when", so resolve it against the household's member list for a
  // display name. Falls back to the raw userId if the giver isn't in the
  // current members array — defensive only (leaving a household isn't
  // implemented yet, so this shouldn't happen today).
  const displayNameFor = (userId: string) =>
    household?.members.find((m) => m.userId === userId)?.displayName ?? userId;

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const lastDose = item.log.length > 0 ? item.log[item.log.length - 1] : null;
          return (
            <View style={{ gap: 4 }}>
              <Text>{item.name} — {item.dosage} ({item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d)</Text>
              <Text>
                Last given:{' '}
                {lastDose
                  ? `${new Date(lastDose.givenAt).toLocaleString()} by ${displayNameFor(lastDose.givenBy)}`
                  : 'never'}
              </Text>
              <Button title="Mark dose as given" onPress={() => handleMarkGiven(item.id)} />
            </View>
          );
        }}
        ListEmptyComponent={<Text>No medications yet.</Text>}
      />
    </View>
  );
}
