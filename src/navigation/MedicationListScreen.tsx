import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose, skipMedicationDose } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';
import { ScreenContainer, Card, Button, Subtitle, MutedText, ErrorText } from '../components/ui';
import { spacing } from '../theme/theme';

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

  const handleMarkGiven = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await logMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSkip = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await skipMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const displayNameFor = (userId: string) =>
    household?.members.find((m) => m.userId === userId)?.displayName ?? userId;

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      {error && <ErrorText>{error}</ErrorText>}
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => {
          const lastAction = item.log.length > 0 ? item.log[item.log.length - 1] : null;
          return (
            <Card style={{ gap: spacing.xs }}>
              <Subtitle>{item.name} — {item.dosage}</Subtitle>
              <MutedText>
                {item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d
              </MutedText>
              <MutedText>
                {lastAction
                  ? `${lastAction.skipped ? 'Last skipped' : 'Last given'}: ${new Date(lastAction.givenAt).toLocaleString()} by ${displayNameFor(lastAction.givenBy)}`
                  : 'No doses logged yet'}
              </MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Mark dose as given" variant="accent" onPress={() => handleMarkGiven(item.id)} style={{ flex: 1 }} />
                <Button title="Skip this dose" variant="outline" onPress={() => handleSkip(item.id)} style={{ flex: 1 }} />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<MutedText>No medications yet.</MutedText>}
      />
    </ScreenContainer>
  );
}
